import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
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
    // Stores the session in SecureStore on native and keeps the web client
    // working when it is served from a different origin than the API (dev).
    plugins: [expo()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
