import {
  preferencesPatchSchema,
  type HealthResponse,
  type MeResponse,
  type Preferences,
} from '@autobourdain/shared';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';

import { createAuth, trustedOrigins } from './auth';
import { readPreferences, writePreferences } from './preferences';
import { turnstilePage } from './turnstile-page';

const app = new Hono<{ Bindings: Env }>();

/**
 * In production the app and API share an origin, so CORS is a no-op. It only
 * matters in dev, where the Expo dev server runs on :8081 and calls :8787.
 */
app.use('/api/*', (c, next) => {
  const allowed = trustedOrigins(c.env);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    credentials: true,
    // x-captcha-response carries the Turnstile token on sign-in/sign-up.
    allowHeaders: ['Content-Type', 'Authorization', 'x-captcha-response'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // The Expo client reads the session token from this header.
    exposeHeaders: ['set-auth-token'],
  })(c, next);
});

app.get('/api/health', (c) =>
  c.json<HealthResponse>({
    ok: true,
    service: 'autobourdain-api',
    time: new Date().toISOString(),
  }),
);

// better-auth owns everything under /api/auth: sign-up, sign-in, OAuth
// callbacks, session refresh, sign-out.
app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  const auth = createAuth(c.env, new URL(c.req.url).origin);
  return auth.handler(c.req.raw);
});

app.get('/api/me', async (c) => {
  const auth = createAuth(c.env, new URL(c.req.url).origin);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return c.json<MeResponse>({ user: session?.user ?? null });
});

/**
 * Turns away a request with no session, and hands the handlers after it the
 * user's id.
 */
const requireUser = createMiddleware<{ Bindings: Env; Variables: { userId: string } }>(
  async (c, next) => {
    const auth = createAuth(c.env, new URL(c.req.url).origin);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', session.user.id);
    await next();
  },
);

app.get('/api/preferences', requireUser, async (c) =>
  c.json<Preferences>(await readPreferences(c.env, c.get('userId'))),
);

// The session is checked before the body, so a signed-out caller learns
// nothing about which preferences exist.
app.patch(
  '/api/preferences',
  requireUser,
  zValidator('json', preferencesPatchSchema, (result, c) => {
    if (!result.success) return c.json({ error: 'Invalid preferences' }, 400);
  }),
  async (c) => {
    const userId = c.get('userId');
    await writePreferences(c.env, userId, c.req.valid('json'));
    return c.json<Preferences>(await readPreferences(c.env, userId));
  },
);

// The Turnstile widget as a page, for the native app to load in a WebView -
// see apps/api/src/turnstile-page.ts. Public and GET-only: the site key it
// carries is public by design, and nothing here touches the session.
app.get('/api/turnstile', (c) => {
  const theme = c.req.query('theme');
  return c.html(
    turnstilePage(c.env.TURNSTILE_SITE_KEY, theme === 'dark' || theme === 'light' ? theme : 'auto'),
  );
});

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// Everything else is the Expo web build. Assets normally short-circuit before
// the Worker runs; this is the fallback when they do not.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
