import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import app from '../src/index';
import { envWith, FAILING_TURNSTILE_SECRET, get, post, testUser, worker } from './helpers';

describe('Turnstile gating', () => {
  it('refuses a sign-up with no token, and creates nothing', async () => {
    const user = testUser();

    const response = await worker.fetch(post('/api/auth/sign-up/email', user, { captcha: false }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'MISSING_RESPONSE' });
    const row = await env.DB.prepare('SELECT id FROM user WHERE email = ?')
      .bind(user.email)
      .first();
    expect(row).toBeNull();
  });

  it('refuses a sign-in with no token', async () => {
    const user = testUser();

    const response = await worker.fetch(
      post(
        '/api/auth/sign-in/email',
        { email: user.email, password: user.password },
        { captcha: false },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'MISSING_RESPONSE' });
  });

  it('refuses a password reset with no token', async () => {
    const response = await worker.fetch(
      post(
        '/api/auth/request-password-reset',
        { email: 'someone@example.com' },
        { captcha: false },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'MISSING_RESPONSE' });
  });

  it('refuses a token Cloudflare rejects', async () => {
    // Same request as a passing one, against the always-fails secret.
    const ctx = createExecutionContext();

    const response = await app.fetch(
      post('/api/auth/sign-up/email', testUser()),
      envWith({ TURNSTILE_SECRET_KEY: FAILING_TURNSTILE_SECRET }),
      ctx,
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'VERIFICATION_FAILED' });
  });

  it('leaves the ungated endpoints alone', async () => {
    const health = await worker.fetch(get('/api/health', { captcha: false }));
    const me = await worker.fetch(get('/api/me', { captcha: false }));

    expect(health.status).toBe(200);
    expect(me.status).toBe(200);
  });
});
