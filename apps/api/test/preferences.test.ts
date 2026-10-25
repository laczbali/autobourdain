import { DEFAULT_PREFERENCES, type Preferences } from '@autobourdain/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { get, patch, signUp, userIdFor, worker } from './helpers';

describe('/api/preferences', () => {
  it('turns away a signed-out read', async () => {
    const response = await worker.fetch(get('/api/preferences'));
    expect(response.status).toBe(401);
  });

  it('turns away a signed-out write, before looking at the body', async () => {
    const response = await worker.fetch(patch('/api/preferences', { nonsense: true }));
    expect(response.status).toBe(401);
  });

  it('gives a new user the defaults', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(get('/api/preferences', { cookie }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it('stores a change and reads it back', async () => {
    const { cookie } = await signUp();

    const written = await worker.fetch(
      patch('/api/preferences', { theme: 'warm-ink', mode: 'dark' }, { cookie }),
    );
    expect(written.status).toBe(200);
    await expect(written.json()).resolves.toEqual({
      ...DEFAULT_PREFERENCES,
      theme: 'warm-ink',
      mode: 'dark',
    });

    const read = await worker.fetch(get('/api/preferences', { cookie }));
    await expect(read.json()).resolves.toEqual({
      ...DEFAULT_PREFERENCES,
      theme: 'warm-ink',
      mode: 'dark',
    });
  });

  it('leaves the keys a patch does not mention alone', async () => {
    const { cookie } = await signUp();
    await worker.fetch(patch('/api/preferences', { theme: 'warm-ink' }, { cookie }));

    const response = await worker.fetch(patch('/api/preferences', { mode: 'light' }, { cookie }));

    await expect(response.json()).resolves.toEqual({
      ...DEFAULT_PREFERENCES,
      theme: 'warm-ink',
      mode: 'light',
    });
  });

  it('overwrites a key that is set again', async () => {
    const { cookie } = await signUp();
    await worker.fetch(patch('/api/preferences', { mode: 'dark' }, { cookie }));

    const response = await worker.fetch(patch('/api/preferences', { mode: 'light' }, { cookie }));

    await expect(response.json<Preferences>()).resolves.toMatchObject({ mode: 'light' });
  });

  it('takes an empty patch as a read', async () => {
    const { cookie } = await signUp();
    await worker.fetch(patch('/api/preferences', { theme: 'warm-ink' }, { cookie }));

    const response = await worker.fetch(patch('/api/preferences', {}, { cookie }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ...DEFAULT_PREFERENCES,
      theme: 'warm-ink',
      mode: 'system',
    });
  });

  it('stores likes & dislikes, trimmed', async () => {
    const { cookie } = await signUp();

    await worker.fetch(
      patch('/api/preferences', { recipePreferences: '  No mushrooms.\n' }, { cookie }),
    );

    const read = await worker.fetch(get('/api/preferences', { cookie }));
    await expect(read.json<Preferences>()).resolves.toMatchObject({
      recipePreferences: 'No mushrooms.',
    });
  });

  it('takes likes & dislikes right up to the limit', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(
      patch('/api/preferences', { recipePreferences: 'x'.repeat(2000) }, { cookie }),
    );

    expect(response.status).toBe(200);
  });

  it.each([
    ['an unknown theme', { theme: 'cool-sage' }],
    ['an unknown mode', { mode: 'sepia' }],
    ['an unknown key', { fontSize: 14 }],
    ['a null value', { mode: null }],
    ['a body that is not an object', ['dark']],
    ['likes & dislikes over the limit', { recipePreferences: 'x'.repeat(2001) }],
    ['likes & dislikes that are not text', { recipePreferences: 42 }],
  ])('rejects %s and stores nothing', async (_, body) => {
    const { cookie } = await signUp();

    const response = await worker.fetch(patch('/api/preferences', body, { cookie }));

    expect(response.status).toBe(400);
    const read = await worker.fetch(get('/api/preferences', { cookie }));
    await expect(read.json()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it('rejects the whole patch when one key is invalid', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(
      patch('/api/preferences', { theme: 'warm-ink', mode: 'sepia' }, { cookie }),
    );

    expect(response.status).toBe(400);
    const read = await worker.fetch(get('/api/preferences', { cookie }));
    await expect(read.json()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it('falls back to the default for a stored row that no longer fits', async () => {
    const { cookie } = await signUp();
    const userId = await userIdFor(cookie);
    // Written straight to D1, as a since-removed theme or a retired key would
    // have been.
    await env.DB.batch([
      env.DB.prepare('INSERT INTO user_preferences (user_id, key, value) VALUES (?, ?, ?)').bind(
        userId,
        'theme',
        JSON.stringify('cool-sage'),
      ),
      env.DB.prepare('INSERT INTO user_preferences (user_id, key, value) VALUES (?, ?, ?)').bind(
        userId,
        'retired',
        JSON.stringify(true),
      ),
    ]);

    const response = await worker.fetch(get('/api/preferences', { cookie }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps one user's preferences from another", async () => {
    const first = await signUp();
    const second = await signUp();
    await worker.fetch(patch('/api/preferences', { theme: 'warm-ink' }, { cookie: first.cookie }));

    const response = await worker.fetch(get('/api/preferences', { cookie: second.cookie }));

    await expect(response.json()).resolves.toEqual(DEFAULT_PREFERENCES);
  });
});
