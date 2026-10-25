import {
  type AiModelsResponse,
  type AiSettings,
  type ApiErrorBody,
  type SuggestResponse,
} from '@autobourdain/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { WORKERS_AI_MODELS } from '../src/ai/workers-ai';
import { BASE_SYSTEM_PROMPT } from '../src/suggest/prompt';
import { fakeAnthropic, VALID_KEY } from './fake-anthropic';
import { fakeWorkersAi, setRole } from './fake-workers-ai';
import { del, get, patch, post, put, signUp, userIdFor } from './helpers';

const DEFAULT_MODEL = WORKERS_AI_MODELS[0]?.id;

function suggestion(title: string) {
  return {
    title,
    description: 'A test dish.',
    portions: 2,
    ingredients: [{ name: 'Leeks', quantity: 2, unit: null }],
    method: ['Cook it.'],
  };
}

const OUTPUT = { suggestions: [suggestion('One'), suggestion('Two'), suggestion('Three')] };
const SHORT_OUTPUT = { suggestions: [suggestion('Only')] };

const ASK = { ask: 'something with leeks', mealType: 'Dinner' };

/** A pro user with Workers AI switched on. */
async function signUpOnWorkersAi(replies?: unknown[]) {
  const ai = fakeWorkersAi(replies);
  const { cookie } = await signUp();
  await setRole(cookie, 'pro');
  const response = await ai.fetch(put('/api/ai', { provider: 'workers-ai' }, { cookie }));
  expect(response.status).toBe(200);
  // Setting up runs nothing - the model list is the app's own.
  expect(ai.runs).toHaveLength(0);
  return { ai, cookie };
}

describe('Workers AI access', () => {
  it('is refused to a normal user, and nothing is stored', async () => {
    const ai = fakeWorkersAi();
    const { cookie } = await signUp();

    const response = await ai.fetch(put('/api/ai', { provider: 'workers-ai' }, { cookie }));

    expect(response.status).toBe(403);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({
      code: 'ai_not_allowed',
    });
    const read = await ai.fetch(get('/api/ai', { cookie }));
    await expect(read.json()).resolves.toEqual({ connections: [] });
  });

  it.each(['pro', 'admin'] as const)('is set up for %s on first use, with no key', async (role) => {
    const ai = fakeWorkersAi();
    const { cookie } = await signUp();
    await setRole(cookie, role);

    const response = await ai.fetch(put('/api/ai', { provider: 'workers-ai' }, { cookie }));

    await expect(response.json()).resolves.toEqual({
      connections: [{ provider: 'workers-ai', model: DEFAULT_MODEL, keyHint: null, active: true }],
    });
  });

  it('keeps a stored key when switching away from it, and back', async () => {
    fakeAnthropic();
    const ai = fakeWorkersAi();
    const { cookie } = await signUp();
    await setRole(cookie, 'pro');
    await ai.fetch(put('/api/ai-key', { provider: 'anthropic', apiKey: VALID_KEY }, { cookie }));

    const away = await ai.fetch(put('/api/ai', { provider: 'workers-ai' }, { cookie }));

    await expect(away.json<AiSettings>()).resolves.toEqual({
      connections: [
        { provider: 'anthropic', model: 'claude-test-newest', keyHint: 'abcd', active: false },
        { provider: 'workers-ai', model: DEFAULT_MODEL, keyHint: null, active: true },
      ],
    });

    const back = await ai.fetch(put('/api/ai', { provider: 'anthropic' }, { cookie }));

    const { connections } = await back.json<AiSettings>();
    expect(connections.map(({ provider, active }) => [provider, active])).toEqual([
      ['anthropic', true],
      ['workers-ai', false],
    ]);
  });

  it('leaves nothing active when the active key is deleted', async () => {
    fakeAnthropic();
    const { ai, cookie } = await signUpOnWorkersAi();
    await ai.fetch(put('/api/ai-key', { provider: 'anthropic', apiKey: VALID_KEY }, { cookie }));

    await ai.fetch(del('/api/ai-key/anthropic', { cookie }));

    const read = await ai.fetch(get('/api/ai', { cookie }));
    await expect(read.json<AiSettings>()).resolves.toMatchObject({
      connections: [{ provider: 'workers-ai', active: false }],
    });
    const ask = await ai.fetch(post('/api/suggest', ASK, { cookie }));
    expect(ask.status).toBe(409);
  });

  it('offers the models picked for the app', async () => {
    const { ai, cookie } = await signUpOnWorkersAi();

    const response = await ai.fetch(get('/api/ai/models', { cookie }));

    await expect(response.json<AiModelsResponse>()).resolves.toMatchObject({
      models: WORKERS_AI_MODELS,
    });
  });

  it('takes the list from the code, not from what was stored at setup', async () => {
    const { ai, cookie } = await signUpOnWorkersAi();
    await env.DB.prepare(
      "UPDATE user_ai_credentials SET models = ? WHERE user_id = ? AND provider = 'workers-ai'",
    )
      .bind(JSON.stringify([{ id: '@cf/an/old-model', label: 'Old' }]), await userIdFor(cookie))
      .run();

    const response = await ai.fetch(get('/api/ai/models', { cookie }));

    await expect(response.json<AiModelsResponse>()).resolves.toMatchObject({
      models: WORKERS_AI_MODELS,
    });
  });

  it('refuses a model that is not on the list', async () => {
    const { ai, cookie } = await signUpOnWorkersAi();

    const response = await ai.fetch(patch('/api/ai', { model: '@cf/not/on-the-list' }, { cookie }));

    expect(response.status).toBe(400);
  });

  describe('after a demotion', () => {
    it.each([
      ['an ask', (cookie: string) => post('/api/suggest', ASK, { cookie })],
      ['a connection test', (cookie: string) => post('/api/ai/test', {}, { cookie })],
    ])('refuses %s, and runs nothing', async (_, request) => {
      const { ai, cookie } = await signUpOnWorkersAi();
      await setRole(cookie, 'normal');

      const response = await ai.fetch(request(cookie));

      expect(response.status).toBe(403);
      await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({
        code: 'ai_not_allowed',
      });
      expect(ai.runs).toHaveLength(0);
    });

    it('still shows the setup, so the user can switch away', async () => {
      const { ai, cookie } = await signUpOnWorkersAi();
      await setRole(cookie, 'normal');

      const response = await ai.fetch(get('/api/ai', { cookie }));

      await expect(response.json<AiSettings>()).resolves.toMatchObject({
        connections: [{ provider: 'workers-ai', active: true }],
      });
    });
  });
});

describe('POST /api/ai/test on Workers AI', () => {
  it('sends a tiny request to the chosen model', async () => {
    const { ai, cookie } = await signUpOnWorkersAi([{ response: 'OK' }]);

    const response = await ai.fetch(post('/api/ai/test', {}, { cookie }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, model: DEFAULT_MODEL });
    expect(ai.runs).toHaveLength(1);
    expect(ai.runs[0]?.model).toBe(DEFAULT_MODEL);
    expect(ai.runs[0]?.inputs.max_tokens).toBeLessThanOrEqual(16);
  });
});

describe('POST /api/suggest on Workers AI', () => {
  it('asks the chosen model in JSON mode, with the prompt and the ask', async () => {
    const { ai, cookie } = await signUpOnWorkersAi([{ response: OUTPUT }]);

    const response = await ai.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(200);
    const { suggestions } = await response.json<SuggestResponse>();
    expect(suggestions.map(({ title }) => title)).toEqual(['One', 'Two', 'Three']);

    const [run] = ai.runs;
    expect(run?.model).toBe(DEFAULT_MODEL);
    expect(run?.inputs.messages).toEqual([
      { role: 'system', content: BASE_SYSTEM_PROMPT },
      { role: 'user', content: expect.stringContaining('something with leeks') },
    ]);
    expect(run?.inputs.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { type: 'object', required: ['suggestions'] },
    });
  });

  it.each([
    ['a JSON string', { response: JSON.stringify(OUTPUT) }],
    ['a chat completion', { choices: [{ message: { content: JSON.stringify(OUTPUT) } }] }],
  ])('reads a reply that comes back as %s', async (_, reply) => {
    const { ai, cookie } = await signUpOnWorkersAi([reply]);

    const response = await ai.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(200);
  });

  it.each([
    ['out of shape', { response: SHORT_OUTPUT }],
    ['not JSON', { response: 'Here are three ideas: ...' }],
    ['refused by JSON mode', new Error("JSON Mode couldn't be met")],
  ])('tries once more when the reply is %s', async (_, first) => {
    const { ai, cookie } = await signUpOnWorkersAi([first, { response: OUTPUT }]);

    const response = await ai.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(200);
    expect(ai.runs).toHaveLength(2);
  });

  it('gives up after a second reply out of shape', async () => {
    const { ai, cookie } = await signUpOnWorkersAi([{ response: SHORT_OUTPUT }]);

    const response = await ai.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(502);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code: 'ai_bad_output' });
    expect(ai.runs).toHaveLength(2);
  });

  it('gives each attempt 60 seconds', async () => {
    const { ai, cookie } = await signUpOnWorkersAi([{ response: OUTPUT }]);

    await ai.fetch(post('/api/suggest', ASK, { cookie }));

    expect(ai.runs[0]?.options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('turns a timed-out attempt into ai_unavailable', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const { ai, cookie } = await signUpOnWorkersAi([timeout]);

    const response = await ai.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'The provider could not be reached',
      code: 'ai_unavailable',
    });
  });

  it.each([
    ['the daily allowance running out', '3036: Account limited', 422, 'ai_rejected'],
    ['a model that needs Workers Paid', '5035: Model requires paid plan', 422, 'ai_rejected'],
    ['a missing model', '5007: No such model', 409, 'ai_model_unavailable'],
    ['no capacity', '3040: Capacity temporarily exceeded', 429, 'ai_rate_limited'],
    ['a timeout', '3007: Request timeout', 503, 'ai_unavailable'],
    ['anything else', 'Something broke', 503, 'ai_unavailable'],
  ])('turns %s into a code the client can act on', async (_, message, status, code) => {
    const { ai, cookie } = await signUpOnWorkersAi([new Error(message)]);

    const response = await ai.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(status);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code });
  });
});
