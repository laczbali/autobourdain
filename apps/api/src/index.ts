import {
  aiKeyPatchSchema,
  aiKeyPutSchema,
  preferencesPatchSchema,
  suggestRequestSchema,
  type AiKeyResponse,
  type AiModelsResponse,
  type ApiErrorBody,
  type HealthResponse,
  type MeResponse,
  type Preferences,
  type SuggestResponse,
} from '@autobourdain/shared';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import {
  deleteAiKey,
  getAiKey,
  getAiKeyForUse,
  getModels,
  saveAiKey,
  setAiModel,
} from './ai/credentials';
import { AiError } from './ai/errors';
import { aiErrorResponse } from './ai/http';
import { ADAPTERS } from './ai/registry';
import { createAuth, trustedOrigins } from './auth';
import { readPreferences, writePreferences } from './preferences';
import { generateSuggestions } from './suggest/suggest';
import { turnstilePage } from './turnstile-page';

const app = new Hono<{ Bindings: Env }>();

// A provider failure becomes the same response wherever it is thrown. Anything
// else is a bug, and stays a bare 500.
app.onError((error, c) => {
  if (error instanceof AiError) {
    const { status, body } = aiErrorResponse(error);
    return c.json<ApiErrorBody>(body, status);
  }
  if (error instanceof HTTPException) return error.getResponse();
  console.error(error);
  return c.json<ApiErrorBody>({ error: 'Internal server error' }, 500);
});

const NO_AI_KEY: ApiErrorBody = { error: 'No API key is stored', code: 'no_ai_key' };

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

// The user's AI provider key. It goes in through PUT and never comes back out:
// reads return the provider, the model and the key's last four characters.
app.get('/api/ai-key', requireUser, async (c) =>
  c.json<AiKeyResponse>(await getAiKey(c.env, c.get('userId'))),
);

app.put(
  '/api/ai-key',
  requireUser,
  zValidator('json', aiKeyPutSchema, (result, c) => {
    if (!result.success) return c.json<ApiErrorBody>({ error: 'Invalid key' }, 400);
  }),
  async (c) => c.json<AiKeyResponse>(await saveAiKey(c.env, c.get('userId'), c.req.valid('json'))),
);

app.patch(
  '/api/ai-key',
  requireUser,
  zValidator('json', aiKeyPatchSchema, (result, c) => {
    if (!result.success) return c.json<ApiErrorBody>({ error: 'Invalid model' }, 400);
  }),
  async (c) => {
    const result = await setAiModel(c.env, c.get('userId'), c.req.valid('json').model);
    if (result.status === 'no_key') return c.json(NO_AI_KEY, 409);
    if (result.status === 'unknown_model') {
      return c.json<ApiErrorBody>({ error: 'The key cannot use that model' }, 400);
    }
    return c.json<AiKeyResponse>(result.key);
  },
);

app.delete('/api/ai-key', requireUser, async (c) => {
  await deleteAiKey(c.env, c.get('userId'));
  return c.body(null, 204);
});

// The models the key can use, from the cache unless it is a day old or
// `?refresh=true` asks for a fresh list.
app.get('/api/ai-key/models', requireUser, async (c) => {
  const list = await getModels(c.env, c.get('userId'), {
    refresh: c.req.query('refresh') === 'true',
  });
  if (!list) return c.json(NO_AI_KEY, 409);
  return c.json<AiModelsResponse>({
    models: list.models,
    fetchedAt: list.fetchedAt.toISOString(),
  });
});

// Three meal suggestions from the user's own model, with their likes &
// dislikes added to the prompt.
app.post(
  '/api/suggest',
  requireUser,
  zValidator('json', suggestRequestSchema, (result, c) => {
    if (!result.success) return c.json<ApiErrorBody>({ error: 'Invalid ask' }, 400);
  }),
  async (c) => {
    const userId = c.get('userId');
    const key = await getAiKeyForUse(c.env, userId);
    if (!key) return c.json(NO_AI_KEY, 409);

    const { recipePreferences } = await readPreferences(c.env, userId);
    const response = await generateSuggestions(
      ADAPTERS[key.provider],
      { apiKey: key.apiKey, model: key.model },
      c.req.valid('json'),
      recipePreferences,
    );
    return c.json<SuggestResponse>(response);
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
