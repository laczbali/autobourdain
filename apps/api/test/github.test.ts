import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import app from '../src/index';
import { envWith, post, worker } from './helpers';

const signInWithGithub = () =>
  post('/api/auth/sign-in/social', { provider: 'github', callbackURL: '/' });

describe('GitHub sign-in', () => {
  it('is not registered when the credentials are missing', async () => {
    const response = await worker.fetch(signInWithGithub());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'PROVIDER_NOT_FOUND' });
  });

  it('hands back a GitHub authorize URL when they are set', async () => {
    const ctx = createExecutionContext();

    const response = await app.fetch(
      signInWithGithub(),
      envWith({ GITHUB_CLIENT_ID: 'test-client-id', GITHUB_CLIENT_SECRET: 'test-client-secret' }),
      ctx,
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = await response.json<{ url: string; redirect: boolean }>();
    expect(body.url).toContain('https://github.com/login/oauth/authorize');
    expect(body.url).toContain('client_id=test-client-id');
  });
});
