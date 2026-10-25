import type { MeResponse } from '@autobourdain/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import {
  addAppRows,
  get,
  NO_ROWS,
  PASSWORD,
  post,
  rowsFor,
  signUp,
  userIdFor,
  worker,
} from './helpers';

/**
 * The dev app's origin, which vitest.config.ts trusts. better-auth refuses a
 * request that carries a cookie but no trusted origin, as a browser's would.
 */
const APP_ORIGIN = 'http://localhost:8081';

const deleteAccount = (body: unknown, cookie?: string, origin = APP_ORIGIN) =>
  worker.fetch(post('/api/auth/delete-user', body, { cookie, origin }));

async function me(cookie: string) {
  const response = await worker.fetch(get('/api/me', { cookie }));
  return (await response.json<MeResponse>()).user;
}

/** Moves a user's sessions back two days, past better-auth's one-day freshness. */
async function ageSessions(userId: string) {
  await env.DB.prepare('UPDATE session SET created_at = created_at - 172800 WHERE user_id = ?')
    .bind(userId)
    .run();
}

describe('POST /api/auth/delete-user', () => {
  it('refuses a signed-out caller', async () => {
    const response = await deleteAccount({ password: PASSWORD });
    expect(response.status).toBe(401);
  });

  it('refuses a request from an untrusted origin', async () => {
    const { cookie } = await signUp();
    const id = await userIdFor(cookie);

    const response = await deleteAccount({ password: PASSWORD }, cookie, 'https://evil.example');

    expect(response.status).toBe(403);
    expect((await rowsFor(id)).user).toBe(1);
  });

  it('deletes the user with their password, and everything that was theirs', async () => {
    const { cookie } = await signUp();
    const id = await userIdFor(cookie);
    await addAppRows(id);

    const response = await deleteAccount({ password: PASSWORD }, cookie);

    expect(response.status).toBe(200);
    expect(await rowsFor(id)).toEqual(NO_ROWS);
    expect(await me(cookie)).toBeNull();
  });

  it('refuses a wrong password, and deletes nothing', async () => {
    const { cookie } = await signUp();
    const id = await userIdFor(cookie);

    const response = await deleteAccount({ password: 'not-the-password' }, cookie);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_PASSWORD' });
    expect((await rowsFor(id)).user).toBe(1);
  });

  it('takes a fresh session without a password', async () => {
    const { cookie } = await signUp();
    const id = await userIdFor(cookie);

    expect((await deleteAccount({}, cookie)).status).toBe(200);
    expect((await rowsFor(id)).user).toBe(0);
  });

  it('wants the password once the session is a day old', async () => {
    const { cookie } = await signUp();
    const id = await userIdFor(cookie);
    await ageSessions(id);

    const stale = await deleteAccount({}, cookie);
    expect(stale.status).toBe(400);
    await expect(stale.json()).resolves.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect((await rowsFor(id)).user).toBe(1);

    expect((await deleteAccount({ password: PASSWORD }, cookie)).status).toBe(200);
  });

  it('refuses an admin, even with the password', async () => {
    const { cookie } = await signUp();
    const id = await userIdFor(cookie);
    await env.DB.prepare("UPDATE user SET role = 'admin' WHERE id = ?").bind(id).run();

    const response = await deleteAccount({ password: PASSWORD }, cookie);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'ADMIN_CANNOT_DELETE_SELF' });
    expect((await rowsFor(id)).user).toBe(1);
    expect(await me(cookie)).not.toBeNull();
  });
});
