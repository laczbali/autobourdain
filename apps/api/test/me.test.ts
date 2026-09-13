import type { MeResponse } from '@autobourdain/shared';
import { describe, expect, it } from 'vitest';

import { get, signUp, worker } from './helpers';

describe('GET /api/me', () => {
  it('reports no user when signed out', async () => {
    const response = await worker.fetch(get('/api/me'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: null });
  });

  it('reports the signed-in user', async () => {
    const { user, cookie } = await signUp();

    const response = await worker.fetch(get('/api/me', { cookie }));

    expect(response.status).toBe(200);
    const body = await response.json<MeResponse>();
    expect(body.user).toMatchObject({
      name: user.name,
      email: user.email,
      emailVerified: false,
    });
    expect(typeof body.user?.id).toBe('string');
  });

  it('ignores a session cookie that means nothing', async () => {
    const response = await worker.fetch(
      get('/api/me', { cookie: 'better-auth.session_token=made-up' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: null });
  });
});
