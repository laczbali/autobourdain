import type { HealthResponse, MeResponse } from '@autobourdain/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { createAuth, trustedOrigins } from './auth';

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
    allowHeaders: ['Content-Type', 'Authorization'],
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

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// Everything else is the Expo web build. Assets normally short-circuit before
// the Worker runs; this is the fallback when they do not.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
