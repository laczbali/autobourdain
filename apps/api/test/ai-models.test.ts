import type { AiKeyResponse, AiModelsResponse, ApiErrorBody } from '@autobourdain/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';

import { errorResponse, fakeAnthropic, VALID_KEY } from './fake-anthropic';
import { get, put, signUp, userIdFor, worker } from './helpers';

async function signUpWithKey() {
  const { cookie } = await signUp();
  await worker.fetch(put('/api/ai-key', { provider: 'anthropic', apiKey: VALID_KEY }, { cookie }));
  return { cookie, userId: await userIdFor(cookie) };
}

/** Pushes the cached list back by a little over a day. */
async function ageModels(userId: string) {
  await env.DB.prepare(
    'UPDATE user_ai_credentials SET models_fetched_at = models_fetched_at - 90000 WHERE user_id = ?',
  )
    .bind(userId)
    .run();
}

const modelCalls = (calls: { path: string }[]) =>
  calls.filter(({ path }) => path === '/v1/models').length;

describe('/api/ai-key/models', () => {
  it('turns away a signed-out read', async () => {
    const response = await worker.fetch(get('/api/ai-key/models'));
    expect(response.status).toBe(401);
  });

  it('has nothing to list without a key', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(get('/api/ai-key/models', { cookie }));

    expect(response.status).toBe(409);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code: 'no_ai_key' });
  });

  it('serves the list fetched with the key, without asking again', async () => {
    const calls = fakeAnthropic();
    const { cookie } = await signUpWithKey();
    calls.length = 0;

    const response = await worker.fetch(get('/api/ai-key/models', { cookie }));

    expect(response.status).toBe(200);
    const body = await response.json<AiModelsResponse>();
    expect(body.models).toEqual([
      { id: 'claude-test-newest', label: 'Display claude-test-newest' },
      { id: 'claude-test-older', label: 'Display claude-test-older' },
    ]);
    expect(Date.parse(body.fetchedAt)).not.toBeNaN();
    expect(modelCalls(calls)).toBe(0);
  });

  it('asks again once the list is a day old', async () => {
    const calls = fakeAnthropic();
    const { cookie, userId } = await signUpWithKey();
    await ageModels(userId);
    calls.length = 0;

    await worker.fetch(get('/api/ai-key/models', { cookie }));

    expect(modelCalls(calls)).toBe(1);
  });

  it('asks again when told to', async () => {
    const calls = fakeAnthropic();
    const { cookie } = await signUpWithKey();
    calls.length = 0;

    await worker.fetch(get('/api/ai-key/models?refresh=true', { cookie }));

    expect(modelCalls(calls)).toBe(1);
  });

  it('asks again when the stored list does not parse', async () => {
    const calls = fakeAnthropic();
    const { cookie, userId } = await signUpWithKey();
    await env.DB.prepare('UPDATE user_ai_credentials SET models = ? WHERE user_id = ?')
      .bind(JSON.stringify([{ nonsense: true }]), userId)
      .run();
    calls.length = 0;

    const response = await worker.fetch(get('/api/ai-key/models', { cookie }));

    expect(response.status).toBe(200);
    expect(modelCalls(calls)).toBe(1);
  });

  it('serves the stale list when the provider is down', async () => {
    fakeAnthropic();
    const { cookie, userId } = await signUpWithKey();
    await ageModels(userId);
    // Takes over from the fake for the rest of the test.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      errorResponse(529, 'overloaded_error', 'Overloaded'),
    );

    const response = await worker.fetch(get('/api/ai-key/models', { cookie }));

    expect(response.status).toBe(200);
    await expect(response.json<AiModelsResponse>()).resolves.toMatchObject({
      models: [{ id: 'claude-test-newest' }, { id: 'claude-test-older' }],
    });
  });

  it('passes on a key the provider no longer accepts', async () => {
    fakeAnthropic();
    const { cookie } = await signUpWithKey();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      errorResponse(401, 'authentication_error', 'invalid x-api-key'),
    );

    const response = await worker.fetch(get('/api/ai-key/models?refresh=true', { cookie }));

    expect(response.status).toBe(422);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({
      code: 'ai_key_invalid',
    });
  });

  it('moves the user to the first model when theirs has gone', async () => {
    fakeAnthropic();
    const { cookie } = await signUp();
    await worker.fetch(
      put(
        '/api/ai-key',
        { provider: 'anthropic', apiKey: VALID_KEY, model: 'claude-test-older' },
        { cookie },
      ),
    );
    fakeAnthropic({ models: [{ id: 'claude-test-newest' }] });

    await worker.fetch(get('/api/ai-key/models?refresh=true', { cookie }));

    const read = await worker.fetch(get('/api/ai-key', { cookie }));
    await expect(read.json<AiKeyResponse>()).resolves.toMatchObject({
      model: 'claude-test-newest',
    });
  });
});
