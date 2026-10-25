import type { AiSettings, ApiErrorBody } from '@autobourdain/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { errorResponse, fakeAnthropic, messageResponse, VALID_KEY } from './fake-anthropic';
import { del, get, patch, post, put, signUp, userIdFor, worker } from './helpers';

async function storeKey(cookie: string, body: Record<string, unknown> = {}) {
  return worker.fetch(
    put('/api/ai-key', { provider: 'anthropic', apiKey: VALID_KEY, ...body }, { cookie }),
  );
}

/** The stored Anthropic connection, from any settings response. */
async function anthropicOf(response: Response) {
  const { connections } = await response.json<AiSettings>();
  return connections.find(({ provider }) => provider === 'anthropic') ?? null;
}

const readSettings = (cookie: string) => worker.fetch(get('/api/ai', { cookie }));

describe('/api/ai-key', () => {
  it.each([
    ['read', get('/api/ai')],
    ['store', put('/api/ai-key', { nonsense: true })],
    ['provider switch', put('/api/ai', { nonsense: true })],
    ['model change', patch('/api/ai', { nonsense: true })],
    ['delete', del('/api/ai-key/anthropic')],
  ])('turns away a signed-out %s, before looking at the body', async (_, request) => {
    const response = await worker.fetch(request);
    expect(response.status).toBe(401);
  });

  it('has nothing set up for a new user', async () => {
    const { cookie } = await signUp();

    const response = await readSettings(cookie);

    await expect(response.json()).resolves.toEqual({ connections: [] });
  });

  it('checks a key with the provider, and stores it active with the first model', async () => {
    const calls = fakeAnthropic();
    const { cookie } = await signUp();

    const response = await storeKey(cookie);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      connections: [
        { provider: 'anthropic', model: 'claude-test-newest', keyHint: 'abcd', active: true },
      ],
    });
    expect(calls).toContainEqual(
      expect.objectContaining({ method: 'GET', path: '/v1/models', apiKey: VALID_KEY }),
    );
  });

  it('keeps the model asked for when the key can use it', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();

    const response = await storeKey(cookie, { model: 'claude-test-older' });

    await expect(anthropicOf(response)).resolves.toMatchObject({ model: 'claude-test-older' });
  });

  it('falls back to the first model when the one asked for is not offered', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();

    const response = await storeKey(cookie, { model: 'claude-test-missing' });

    await expect(anthropicOf(response)).resolves.toMatchObject({ model: 'claude-test-newest' });
  });

  it('only offers models that can return structured output', async () => {
    fakeAnthropic({
      models: [{ id: 'claude-test-plain', structured: false }, { id: 'claude-test-structured' }],
    });
    const { cookie } = await signUp();

    const response = await storeKey(cookie);

    await expect(anthropicOf(response)).resolves.toMatchObject({
      model: 'claude-test-structured',
    });
  });

  it('turns down a key with no usable models, and stores nothing', async () => {
    fakeAnthropic({ models: [{ id: 'claude-test-plain', structured: false }] });
    const { cookie } = await signUp();

    const response = await storeKey(cookie);

    expect(response.status).toBe(422);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code: 'ai_no_models' });
    await expect(anthropicOf(await readSettings(cookie))).resolves.toBeNull();
  });

  it('turns down a key the provider rejects, and stores nothing', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();

    const response = await storeKey(cookie, { apiKey: 'sk-ant-wrong' });

    expect(response.status).toBe(422);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({
      code: 'ai_key_invalid',
    });
    await expect(anthropicOf(await readSettings(cookie))).resolves.toBeNull();
  });

  it.each([
    ['an unknown provider', { provider: 'openai', apiKey: VALID_KEY }],
    ['a provider that takes no key', { provider: 'workers-ai', apiKey: VALID_KEY }],
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

    const read = await readSettings(cookie);
    const text = await read.text();
    expect(text).not.toContain(VALID_KEY);
    expect(JSON.parse(text)).toEqual({
      connections: [
        { provider: 'anthropic', model: 'claude-test-newest', keyHint: 'abcd', active: true },
      ],
    });
  });

  it('replaces a stored key', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();
    await storeKey(cookie, { model: 'claude-test-older' });

    await storeKey(cookie);

    await expect(anthropicOf(await readSettings(cookie))).resolves.toMatchObject({
      model: 'claude-test-newest',
    });
  });

  it('changes the model', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();
    await storeKey(cookie);

    const response = await worker.fetch(
      patch('/api/ai', { model: 'claude-test-older' }, { cookie }),
    );

    expect(response.status).toBe(200);
    await expect(anthropicOf(response)).resolves.toMatchObject({ model: 'claude-test-older' });
  });

  it('refuses a model the key cannot use, after asking for a fresh list', async () => {
    const calls = fakeAnthropic();
    const { cookie } = await signUp();
    await storeKey(cookie);
    calls.length = 0;

    const response = await worker.fetch(
      patch('/api/ai', { model: 'claude-test-missing' }, { cookie }),
    );

    expect(response.status).toBe(400);
    expect(calls).toContainEqual(expect.objectContaining({ path: '/v1/models' }));
  });

  it('cannot change the model without a key', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(
      patch('/api/ai', { model: 'claude-test-older' }, { cookie }),
    );

    expect(response.status).toBe(409);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code: 'no_ai_key' });
  });

  it('deletes the key', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();
    await storeKey(cookie);

    const response = await worker.fetch(del('/api/ai-key/anthropic', { cookie }));

    expect(response.status).toBe(204);
    await expect(readSettings(cookie).then((r) => r.json())).resolves.toEqual({ connections: [] });
  });

  it('only deletes keys, not providers without one', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(del('/api/ai-key/workers-ai', { cookie }));

    expect(response.status).toBe(400);
  });

  it('cannot switch to a keyed provider before its key is stored', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(put('/api/ai', { provider: 'anthropic' }, { cookie }));

    expect(response.status).toBe(409);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code: 'no_ai_key' });
  });

  it("keeps one user's key from another", async () => {
    fakeAnthropic();
    const first = await signUp();
    const second = await signUp();
    await storeKey(first.cookie);

    const response = await readSettings(second.cookie);

    await expect(response.json()).resolves.toEqual({ connections: [] });
  });
});

describe('POST /api/ai/test', () => {
  type Sent = { model: string; max_tokens: number };

  it('turns away a signed-out test', async () => {
    const response = await worker.fetch(post('/api/ai/test', {}));
    expect(response.status).toBe(401);
  });

  it('has nothing to test without a key', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(post('/api/ai/test', {}, { cookie }));

    expect(response.status).toBe(409);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code: 'no_ai_key' });
  });

  it('sends a tiny request to the chosen model', async () => {
    const calls = fakeAnthropic({ replies: ['OK'] });
    const { cookie } = await signUp();
    await storeKey(cookie, { model: 'claude-test-older' });

    const response = await worker.fetch(post('/api/ai/test', {}, { cookie }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, model: 'claude-test-older' });
    const sent = calls.find(({ path }) => path === '/v1/messages')?.body as Sent;
    expect(sent.model).toBe('claude-test-older');
    expect(sent.max_tokens).toBeLessThanOrEqual(16);
  });

  it('passes when the answer is cut off, since one came at all', async () => {
    fakeAnthropic({ replies: [() => messageResponse('O', 'max_tokens')] });
    const { cookie } = await signUp();
    await storeKey(cookie);

    const response = await worker.fetch(post('/api/ai/test', {}, { cookie }));

    expect(response.status).toBe(200);
  });

  it('catches an account the provider will not serve', async () => {
    fakeAnthropic({
      replies: [
        () => errorResponse(400, 'invalid_request_error', 'Your credit balance is too low'),
      ],
    });
    const { cookie } = await signUp();
    await storeKey(cookie);

    const response = await worker.fetch(post('/api/ai/test', {}, { cookie }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: 'Your credit balance is too low',
      code: 'ai_rejected',
    });
  });
});
