import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { captcha } from 'better-auth/plugins';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';

import * as schema from './db/schema';

/** Origins allowed to call the API with credentials, plus the native app scheme. */
export function trustedOrigins(env: Env): string[] {
  const configured = (env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...configured, 'autobourdain://'];
}

/** The addresses `ADMIN_EMAILS` makes admin, lowercased. */
export function adminEmails(env: Env): string[] {
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(env: Env, email: string): boolean {
  return adminEmails(env).includes(email.toLowerCase());
}

/**
 * D1 bindings only exist per-request, so the auth instance is built per-request
 * too. It is cheap: no connections are opened until a query runs.
 */
export function createAuth(env: Env, requestOrigin: string) {
  const db = drizzle(env.DB, { schema });

  const github =
    env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {};

  return betterAuth({
    appName: 'autobourdain',
    // BETTER_AUTH_URL is set in production; locally we mirror the request origin
    // so the same config works on localhost, *.workers.dev and a custom domain.
    baseURL: env.BETTER_AUTH_URL || requestOrigin,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    emailAndPassword: { enabled: true },
    socialProviders: github,
    trustedOrigins: trustedOrigins(env),
    user: {
      additionalFields: {
        // `input: false` keeps it out of sign-up and update-user bodies. Only
        // the admin routes and ADMIN_EMAILS below ever change it.
        role: { type: 'string', required: false, defaultValue: 'normal', input: false },
      },
      // POST /api/auth/delete-user, for the user's own account. better-auth
      // checks the password when one is sent, and otherwise wants a session
      // signed in within the last day. The foreign keys' cascades take the
      // rest of the user's rows with them.
      deleteUser: {
        enabled: true,
        // An admin is refused, so the last admin can never delete themselves.
        // The role is read from the table, as the user handed in here is
        // better-auth's base type, without it.
        beforeDelete: async (user) => {
          const [row] = await db
            .select({ role: schema.user.role })
            .from(schema.user)
            .where(eq(schema.user.id, user.id));
          if (row?.role === 'admin') {
            throw new APIError('FORBIDDEN', {
              message: 'An admin cannot delete their own account',
              code: 'ADMIN_CANNOT_DELETE_SELF',
            });
          }
        },
      },
    },
    // ADMIN_EMAILS only ever grants admin, never takes it away. A new account
    // gets it on sign-up, an existing one on its next sign-in.
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (isAdminEmail(env, user.email)) return { data: { ...user, role: 'admin' } };
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            const emails = adminEmails(env);
            if (emails.length === 0) return;
            await db
              .update(schema.user)
              .set({ role: 'admin' })
              .where(
                and(
                  eq(schema.user.id, session.userId),
                  ne(schema.user.role, 'admin'),
                  inArray(sql`lower(${schema.user.email})`, emails),
                ),
              );
          },
        },
      },
    },
    // Cloudflare sits in front of every request, so its own header is the one
    // that cannot be spoofed by the client. Turnstile gets the IP from here.
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    plugins: [
      // Stores the session in SecureStore on native and keeps the web client
      // working when it is served from a different origin than the API (dev).
      expo(),
      // Turnstile, checked before the request reaches the handler. Registered
      // unconditionally on purpose: a missing secret should break sign-in
      // loudly rather than quietly leave these endpoints ungated. The paths are
      // better-auth's own defaults, spelled out so an upgrade cannot widen or
      // narrow what is gated. GitHub sign-in is not covered - the exchange
      // happens on github.com, behind their abuse checks.
      captcha({
        provider: 'cloudflare-turnstile',
        secretKey: env.TURNSTILE_SECRET_KEY,
        endpoints: ['/sign-up/email', '/sign-in/email', '/request-password-reset'],
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
