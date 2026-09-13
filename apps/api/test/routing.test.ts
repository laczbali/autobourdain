import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import app from '../src/index';
import { envWith, get, worker } from './helpers';

describe('routing', () => {
  it('404s an unknown API path as JSON', async () => {
    const response = await worker.fetch(get('/api/nope'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('404s an unknown API path on any method', async () => {
    const response = await worker.fetch(
      new Request('http://localhost/api/nope', { method: 'DELETE' }),
    );

    expect(response.status).toBe(404);
  });

  it('hands everything else to the assets binding', async () => {
    // A stub rather than the real binding: what matters is that the Worker gets
    // out of the way for non-API paths. Whether Cloudflare can serve the Expo
    // export is Cloudflare's problem, and `npm run preview` shows it.
    const assets = {
      fetch: vi.fn(() => Promise.resolve(new Response('<!doctype html>', { status: 200 }))),
    };
    const ctx = createExecutionContext();

    const response = await app.fetch(get('/some/deep/link'), envWith({ ASSETS: assets }), ctx);
    await waitOnExecutionContext(ctx);

    expect(assets.fetch).toHaveBeenCalledOnce();
    expect(await response.text()).toBe('<!doctype html>');
  });
});
