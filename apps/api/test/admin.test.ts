import type { AdminUser, AdminUsersResponse, MeResponse } from '@autobourdain/shared';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';

import app from '../src/index';
import {
  addAppRows,
  del,
  envWith,
  get,
  NO_ROWS,
  patch,
  post,
  rowsFor,
  sessionCookie,
  signUp,
  testUser,
  userIdFor,
  worker,
} from './helpers';

/** The address vitest.config.ts lists in ADMIN_EMAILS. */
const LISTED_EMAIL = 'listed-admin@example.com';

// Signed up once for the whole file - the address can only be taken once.
let listedCookie: string;
beforeAll(async () => {
  ({ cookie: listedCookie } = await signUp(testUser({ email: LISTED_EMAIL })));
});

async function me(cookie: string) {
  const response = await worker.fetch(get('/api/me', { cookie }));
  const { user } = await response.json<MeResponse>();
  return user;
}

/** Makes a user admin the way nothing in the app can: straight in the table. */
async function makeAdmin(cookie: string): Promise<string> {
  const id = await userIdFor(cookie);
  await env.DB.prepare("UPDATE user SET role = 'admin' WHERE id = ?").bind(id).run();
  return id;
}

const setRole = (id: string, body: unknown, cookie?: string) =>
  worker.fetch(patch(`/api/admin/users/${id}`, body, { cookie }));

describe('roles', () => {
  it('starts every user as normal', async () => {
    const { cookie } = await signUp();
    expect((await me(cookie))?.role).toBe('normal');
  });

  it('ignores a role sent with sign-up', async () => {
    const user = testUser();

    // better-auth drops an `input: false` field from sign-up rather than
    // refusing the request.
    const response = await worker.fetch(
      post('/api/auth/sign-up/email', { ...user, role: 'admin' }),
    );

    expect(response.status).toBe(200);
    expect((await me(sessionCookie(response)))?.role).toBe('normal');
  });

  it('makes a listed email admin on sign-up', async () => {
    expect((await me(listedCookie))?.role).toBe('admin');
  });

  it('promotes an existing listed account on sign-in, and keeps it promoted', async () => {
    const { user } = await signUp();
    // Listed only for this sign-in, in another case and among others.
    const ctx = createExecutionContext();
    const response = await app.fetch(
      post('/api/auth/sign-in/email', { email: user.email, password: user.password }),
      envWith({ ADMIN_EMAILS: ` someone@example.com , ${user.email.toUpperCase()} ` }),
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);

    // Back on the Worker's own config, where the address is not listed.
    expect((await me(sessionCookie(response)))?.role).toBe('admin');
  });
});

describe('GET /api/admin/users', () => {
  let adminCookie: string;
  let adminId: string;

  beforeAll(async () => {
    ({ cookie: adminCookie } = await signUp());
    adminId = await makeAdmin(adminCookie);
  });

  it('refuses a signed-out caller', async () => {
    const response = await worker.fetch(get('/api/admin/users'));
    expect(response.status).toBe(401);
  });

  it('refuses a user who is not an admin', async () => {
    const { cookie } = await signUp();
    const response = await worker.fetch(get('/api/admin/users', { cookie }));
    expect(response.status).toBe(403);
  });

  it('lists every user oldest first, with the locked ones marked', async () => {
    const { user: other, cookie } = await signUp();
    const otherId = await userIdFor(cookie);

    const response = await worker.fetch(get('/api/admin/users', { cookie: adminCookie }));

    expect(response.status).toBe(200);
    const { users } = await response.json<AdminUsersResponse>();
    const byId = new Map(users.map((user) => [user.id, user]));
    expect(byId.get(adminId)).toMatchObject({ role: 'admin', locked: 'self' });
    expect(byId.get(otherId)).toMatchObject({
      name: other.name,
      email: other.email,
      role: 'normal',
      locked: null,
    });
    expect(users.find((user) => user.email === LISTED_EMAIL)?.locked).toBe('admin_emails');

    const times = users.map((user) => user.createdAt);
    expect(times).toEqual([...times].sort());
  });
});

describe('PATCH /api/admin/users/:id', () => {
  let adminCookie: string;
  let adminId: string;

  beforeAll(async () => {
    ({ cookie: adminCookie } = await signUp());
    adminId = await makeAdmin(adminCookie);
  });

  it('refuses a signed-out caller', async () => {
    const response = await setRole(adminId, { role: 'normal' });
    expect(response.status).toBe(401);
  });

  it('refuses a user who is not an admin', async () => {
    const { cookie } = await signUp();
    const response = await setRole(await userIdFor(cookie), { role: 'admin' }, cookie);
    expect(response.status).toBe(403);
    expect((await me(cookie))?.role).toBe('normal');
  });

  it('refuses a role that does not exist, or anything beside it', async () => {
    const { cookie } = await signUp();
    const id = await userIdFor(cookie);

    expect((await setRole(id, { role: 'owner' }, adminCookie)).status).toBe(400);
    expect((await setRole(id, { role: 'pro', name: 'x' }, adminCookie)).status).toBe(400);
    expect((await setRole(id, {}, adminCookie)).status).toBe(400);
  });

  it('answers 404 for a user who does not exist', async () => {
    const response = await setRole('no-such-user', { role: 'pro' }, adminCookie);
    expect(response.status).toBe(404);
  });

  it("refuses to change the admin's own role", async () => {
    const response = await setRole(adminId, { role: 'normal' }, adminCookie);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'role_locked' });
    expect((await me(adminCookie))?.role).toBe('admin');
  });

  it('refuses to change a role ADMIN_EMAILS sets', async () => {
    const response = await setRole(await userIdFor(listedCookie), { role: 'normal' }, adminCookie);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'role_locked' });
  });

  it('changes a role, and the change counts straight away', async () => {
    const { cookie } = await signUp();
    const id = await userIdFor(cookie);

    const promoted = await setRole(id, { role: 'admin' }, adminCookie);
    expect(promoted.status).toBe(200);
    await expect(promoted.json<AdminUser>()).resolves.toMatchObject({
      id,
      role: 'admin',
      locked: null,
    });
    expect((await worker.fetch(get('/api/admin/users', { cookie }))).status).toBe(200);

    expect((await setRole(id, { role: 'pro' }, adminCookie)).status).toBe(200);
    expect((await me(cookie))?.role).toBe('pro');
    expect((await worker.fetch(get('/api/admin/users', { cookie }))).status).toBe(403);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  let adminCookie: string;
  let adminId: string;

  beforeAll(async () => {
    ({ cookie: adminCookie } = await signUp());
    adminId = await makeAdmin(adminCookie);
  });

  const deleteUser = (id: string, cookie?: string) =>
    worker.fetch(del(`/api/admin/users/${id}`, { cookie }));

  it('refuses a signed-out caller', async () => {
    const { cookie } = await signUp();
    const response = await deleteUser(await userIdFor(cookie));
    expect(response.status).toBe(401);
  });

  it('refuses a user who is not an admin', async () => {
    const { cookie } = await signUp();
    const { cookie: otherCookie } = await signUp();
    const id = await userIdFor(otherCookie);

    expect((await deleteUser(id, cookie)).status).toBe(403);
    expect((await rowsFor(id)).user).toBe(1);
  });

  it('answers 404 for a user who does not exist', async () => {
    expect((await deleteUser('no-such-user', adminCookie)).status).toBe(404);
  });

  it('refuses to delete the admin themselves', async () => {
    const response = await deleteUser(adminId, adminCookie);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'user_not_deletable' });
    expect((await rowsFor(adminId)).user).toBe(1);
  });

  it('refuses to delete another admin', async () => {
    const { cookie } = await signUp();
    const id = await makeAdmin(cookie);

    const response = await deleteUser(id, adminCookie);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'user_not_deletable' });
    expect((await rowsFor(id)).user).toBe(1);
  });

  it('refuses to delete a user ADMIN_EMAILS lists', async () => {
    const id = await userIdFor(listedCookie);
    expect((await deleteUser(id, adminCookie)).status).toBe(409);
    expect((await rowsFor(id)).user).toBe(1);
  });

  it('deletes a user and everything that was theirs, and signs them out', async () => {
    const { cookie } = await signUp();
    const id = await userIdFor(cookie);
    await setRole(id, { role: 'pro' }, adminCookie);
    await addAppRows(id);

    const response = await deleteUser(id, adminCookie);

    expect(response.status).toBe(204);
    expect(await rowsFor(id)).toEqual(NO_ROWS);
    expect(await me(cookie)).toBeNull();
  });
});
