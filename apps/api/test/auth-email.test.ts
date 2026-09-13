import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { PASSWORD, post, sessionCookie, signUp, testUser, worker } from './helpers';

describe('email sign-up and sign-in', () => {
  it('creates the user and hands back a session', async () => {
    const user = testUser();

    const response = await worker.fetch(post('/api/auth/sign-up/email', user));

    expect(response.status).toBe(200);
    expect(sessionCookie(response)).toContain('session_token');

    const row = await env.DB.prepare('SELECT name, email, email_verified FROM user WHERE email = ?')
      .bind(user.email)
      .first();
    expect(row).toMatchObject({ name: user.name, email: user.email, email_verified: 0 });
  });

  it('signs an existing user back in', async () => {
    const { user } = await signUp();

    const response = await worker.fetch(
      post('/api/auth/sign-in/email', { email: user.email, password: user.password }),
    );

    expect(response.status).toBe(200);
    expect(sessionCookie(response)).toContain('session_token');
  });

  it('refuses a second account on the same email', async () => {
    const { user } = await signUp();

    const response = await worker.fetch(post('/api/auth/sign-up/email', user));

    expect(response.status).toBe(422);
  });

  it('refuses a wrong password', async () => {
    const { user } = await signUp();

    const response = await worker.fetch(
      post('/api/auth/sign-in/email', { email: user.email, password: 'not-the-password' }),
    );

    expect(response.status).toBe(401);
    expect(sessionCookie(response)).toBe('');
  });

  it('refuses an email that was never signed up', async () => {
    const response = await worker.fetch(
      post('/api/auth/sign-in/email', { email: 'stranger@example.com', password: PASSWORD }),
    );

    expect(response.status).toBe(401);
  });
});
