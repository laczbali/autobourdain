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

export function post(path: string, body: unknown, options: RequestOptions = {}): Request {
  const headers = headersFor(options);
  headers.set('Content-Type', 'application/json');
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
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

/**
 * The test env with some bindings replaced, for the cases that need a different
 * configuration than the Worker was started with. The generated Env types plain
 * vars as string literals, hence the cast.
 */
export function envWith(overrides: Record<string, unknown>): Env {
  return { ...env, ...overrides } as unknown as Env;
}
