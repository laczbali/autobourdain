import type { AiKeyResponse, ApiErrorBody } from '@autobourdain/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { fakeAnthropic, VALID_KEY } from './fake-anthropic';
import { del, get, patch, put, signUp, userIdFor, worker } from './helpers';

async function storeKey(cookie: string, body: Record<string, unknown> = {}) {
  return worker.fetch(
    put('/api/ai-key', { provider: 'anthropic', apiKey: VALID_KEY, ...body }, { cookie }),
  );
}

describe('/api/ai-key', () => {
  it.each([
    ['read', get('/api/ai-key')],
    ['store', put('/api/ai-key', { nonsense: true })],
    ['model change', patch('/api/ai-key', { nonsense: true })],
    ['delete', del('/api/ai-key')],
  ])('turns away a signed-out %s, before looking at the body', async (_, request) => {
    const response = await worker.fetch(request);
    expect(response.status).toBe(401);
  });

  it('has no key for a new user', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(get('/api/ai-key', { cookie }));

    await expect(response.json()).resolves.toBeNull();
  });

  it('checks a key with the provider, and stores it with the first model', async () => {
    const calls = fakeAnthropic();
    const { cookie } = await signUp();

    const response = await storeKey(cookie);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      provider: 'anthropic',
      model: 'claude-test-newest',
      keyHint: 'abcd',
    });
    expect(calls).toContainEqual(
      expect.objectContaining({ method: 'GET', path: '/v1/models', apiKey: VALID_KEY }),
    );
  });

  it('keeps the model asked for when the key can use it', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();

    const response = await storeKey(cookie, { model: 'claude-test-older' });

    await expect(response.json<AiKeyResponse>()).resolves.toMatchObject({
      model: 'claude-test-older',
    });
  });

  it('falls back to the first model when the one asked for is not offered', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();

    const response = await storeKey(cookie, { model: 'claude-test-missing' });

    await expect(response.json<AiKeyResponse>()).resolves.toMatchObject({
      model: 'claude-test-newest',
    });
  });

  it('only offers models that can return structured output', async () => {
    fakeAnthropic({
      models: [{ id: 'claude-test-plain', structured: false }, { id: 'claude-test-structured' }],
    });
    const { cookie } = await signUp();

    const response = await storeKey(cookie);

    await expect(response.json<AiKeyResponse>()).resolves.toMatchObject({
      model: 'claude-test-structured',
    });
  });

  it('turns down a key with no usable models, and stores nothing', async () => {
    fakeAnthropic({ models: [{ id: 'claude-test-plain', structured: false }] });
    const { cookie } = await signUp();

    const response = await storeKey(cookie);

    expect(response.status).toBe(422);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code: 'ai_no_models' });
    const read = await worker.fetch(get('/api/ai-key', { cookie }));
    await expect(read.json()).resolves.toBeNull();
  });

  it('turns down a key the provider rejects, and stores nothing', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();

    const response = await storeKey(cookie, { apiKey: 'sk-ant-wrong' });

    expect(response.status).toBe(422);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({
      code: 'ai_key_invalid',
    });
    const read = await worker.fetch(get('/api/ai-key', { cookie }));
    await expect(read.json()).resolves.toBeNull();
  });

  it.each([
    ['an unknown provider', { provider: 'openai', apiKey: VALID_KEY }],
    ['an empty key', { provider: 'anthropic', apiKey: '  ' }],
    ['an unknown field', { provider: 'anthropic', apiKey: VALID_KEY, extra: true }],
  ])('rejects %s', async (_, body) => {
    const { cookie } = await signUp();

    const response = await worker.fetch(put('/api/ai-key', body, { cookie }));

    expect(response.status).toBe(400);
  });

  it('stores the key encrypted, and never returns it', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();
    await storeKey(cookie);

    const row = await env.DB.prepare('SELECT * FROM user_ai_credentials WHERE user_id = ?')
      .bind(await userIdFor(cookie))
      .first<Record<string, unknown>>();
    expect(JSON.stringify(row)).not.toContain(VALID_KEY);

    const read = await worker.fetch(get('/api/ai-key', { cookie }));
    const text = await read.text();
    expect(text).not.toContain(VALID_KEY);
    expect(JSON.parse(text)).toEqual({
      provider: 'anthropic',
      model: 'claude-test-newest',
      keyHint: 'abcd',
    });
  });

  it('replaces a stored key', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();
    await storeKey(cookie, { model: 'claude-test-older' });

    await storeKey(cookie);

    const read = await worker.fetch(get('/api/ai-key', { cookie }));
    await expect(read.json<AiKeyResponse>()).resolves.toMatchObject({
      model: 'claude-test-newest',
    });
  });

  it('changes the model', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();
    await storeKey(cookie);

    const response = await worker.fetch(
      patch('/api/ai-key', { model: 'claude-test-older' }, { cookie }),
    );

    expect(response.status).toBe(200);
    await expect(response.json<AiKeyResponse>()).resolves.toMatchObject({
      model: 'claude-test-older',
    });
  });

  it('refuses a model the key cannot use, after asking for a fresh list', async () => {
    const calls = fakeAnthropic();
    const { cookie } = await signUp();
    await storeKey(cookie);
    calls.length = 0;

    const response = await worker.fetch(
      patch('/api/ai-key', { model: 'claude-test-missing' }, { cookie }),
    );

    expect(response.status).toBe(400);
    expect(calls).toContainEqual(expect.objectContaining({ path: '/v1/models' }));
  });

  it('cannot change the model without a key', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(
      patch('/api/ai-key', { model: 'claude-test-older' }, { cookie }),
    );

    expect(response.status).toBe(409);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code: 'no_ai_key' });
  });

  it('deletes the key', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();
    await storeKey(cookie);

    const response = await worker.fetch(del('/api/ai-key', { cookie }));

    expect(response.status).toBe(204);
    const read = await worker.fetch(get('/api/ai-key', { cookie }));
    await expect(read.json()).resolves.toBeNull();
  });

  it("keeps one user's key from another", async () => {
    fakeAnthropic();
    const first = await signUp();
    const second = await signUp();
    await storeKey(first.cookie);

    const response = await worker.fetch(get('/api/ai-key', { cookie: second.cookie }));

    await expect(response.json()).resolves.toBeNull();
  });
});
