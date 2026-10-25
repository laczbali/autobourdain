import type { MeResponse } from '@autobourdain/shared';
import { env, exports } from 'cloudflare:workers';

/**
 * The Worker under test, running with its real bindings. `cloudflare:test`'s
 * SELF does the same thing and is what Cloudflare's docs show, but it is
 * deprecated in favour of this.
 */
export const worker = exports.default;

/**
 * Any value passes against Cloudflare's always-passes Turnstile secret, which is
 * what vitest.config.ts binds. A real widget's token looks nothing like this.
 */
export const CAPTCHA_TOKEN = 'any-token-passes-the-test-secret';

/** Cloudflare's always-fails Turnstile secret, for the rejection path. */
export const FAILING_TURNSTILE_SECRET = '2x0000000000000000000000000000000AA';

export const PASSWORD = 'correct-horse-battery-staple';

export type TestUser = { name: string; email: string; password: string };

/**
 * A fresh user on every call. Storage is isolated per test *file*, not per
 * test, so everything in one file shares a database and fixed emails collide.
 */
export function testUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    name: 'Test Person',
    email: `test-${crypto.randomUUID()}@example.com`,
    password: PASSWORD,
    ...overrides,
  };
}

type RequestOptions = {
  /** Sent unless explicitly false - the gated auth endpoints require it. */
  captcha?: boolean;
  cookie?: string;
  origin?: string;
};

function headersFor({ captcha = true, cookie, origin }: RequestOptions): Headers {
  const headers = new Headers();
  if (captcha) headers.set('x-captcha-response', CAPTCHA_TOKEN);
  if (cookie) headers.set('Cookie', cookie);
  if (origin) headers.set('Origin', origin);
  return headers;
}

export function get(path: string, options: RequestOptions = {}): Request {
  return new Request(`http://localhost${path}`, { headers: headersFor(options) });
}

function withJson(method: string, path: string, body: unknown, options: RequestOptions): Request {
  const headers = headersFor(options);
  headers.set('Content-Type', 'application/json');
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

export function post(path: string, body: unknown, options: RequestOptions = {}): Request {
  return withJson('POST', path, body, options);
}

export function patch(path: string, body: unknown, options: RequestOptions = {}): Request {
  return withJson('PATCH', path, body, options);
}

export function put(path: string, body: unknown, options: RequestOptions = {}): Request {
  return withJson('PUT', path, body, options);
}

export function del(path: string, options: RequestOptions = {}): Request {
  return new Request(`http://localhost${path}`, { method: 'DELETE', headers: headersFor(options) });
}

/** Every Set-Cookie the response carries, folded into one Cookie header value. */
export function sessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

/** Signs a user up through the real endpoint, with their session cookie. */
export async function signUp(
  user: TestUser = testUser(),
): Promise<{ user: TestUser; cookie: string }> {
  const response = await worker.fetch(post('/api/auth/sign-up/email', user));
  if (!response.ok) {
    throw new Error(`sign-up failed: ${response.status} ${await response.text()}`);
  }
  return { user, cookie: sessionCookie(response) };
}

/** The id of the user a session cookie belongs to. */
export async function userIdFor(cookie: string): Promise<string> {
  const response = await worker.fetch(get('/api/me', { cookie }));
  const { user } = await response.json<MeResponse>();
  if (!user) throw new Error('no user behind that cookie');
  return user.id;
}

/**
 * The test env with some bindings replaced, for the cases that need a different
 * configuration than the Worker was started with. The generated Env types plain
 * vars as string literals, hence the cast.
 */
export function envWith(overrides: Record<string, unknown>): Env {
  return { ...env, ...overrides } as unknown as Env;
}

/**
 * Gives a user a row in each of the app's own tables, straight in SQL, so a
 * delete has something to cascade to. Sign-up already made the session and
 * the sign-in account.
 */
export async function addAppRows(userId: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO user_preferences (user_id, key, value) VALUES (?, 'mode', '"dark"')`,
    ).bind(userId),
    env.DB.prepare(
      `INSERT INTO user_ai_credentials (user_id, provider, model, models, models_fetched_at)
       VALUES (?, 'workers-ai', 'some-model', '[]', 0)`,
    ).bind(userId),
  ]);
}

/** How many rows each table holds for a user. */
export async function rowsFor(userId: string): Promise<Record<string, number>> {
  const tables = ['user', 'session', 'account', 'user_preferences', 'user_ai_credentials'];
  const counts = await Promise.all(
    tables.map((table) =>
      env.DB.prepare(
        `SELECT count(*) AS n FROM ${table} WHERE ${table === 'user' ? 'id' : 'user_id'} = ?`,
      )
        .bind(userId)
        .first<{ n: number }>(),
    ),
  );
  return Object.fromEntries(tables.map((table, i) => [table, counts[i]?.n ?? 0]));
}

/** What `rowsFor` answers once a user is gone. */
export const NO_ROWS = {
  user: 0,
  session: 0,
  account: 0,
  user_preferences: 0,
  user_ai_credentials: 0,
};
