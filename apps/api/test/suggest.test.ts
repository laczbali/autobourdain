import type { ApiErrorBody, SuggestResponse } from '@autobourdain/shared';
import { describe, expect, it } from 'vitest';

import { BASE_SYSTEM_PROMPT } from '../src/suggest/prompt';
import {
  errorResponse,
  fakeAnthropic,
  messageResponse,
  VALID_KEY,
  type Call,
} from './fake-anthropic';
import { patch, post, put, signUp, worker } from './helpers';

function suggestion(title: string) {
  return {
    title,
    description: 'A test dish.',
    portions: 2,
    totalMinutes: 30,
    ingredients: [
      { name: 'Eggs', quantity: 4, unit: null },
      { name: 'Salt', quantity: null, unit: 'to taste' },
    ],
    method: ['Cook it.'],
  };
}

const OUTPUT = { suggestions: [suggestion('One'), suggestion('Two'), suggestion('Three')] };
/** Valid JSON, wrong shape: one suggestion where three belong. */
const SHORT_OUTPUT = { suggestions: [suggestion('Only')] };

const ASK = { ask: 'something with leeks', mealType: 'Dinner' };

async function signUpWithKey() {
  const { cookie } = await signUp();
  await worker.fetch(put('/api/ai-key', { provider: 'anthropic', apiKey: VALID_KEY }, { cookie }));
  return cookie;
}

const messageCalls = (calls: Call[]) =>
  calls.filter(({ method, path }) => method === 'POST' && path === '/v1/messages');

type SentMessage = {
  model: string;
  system: string;
  messages: { role: string; content: string }[];
  output_config: { format: { type: string }; effort?: string };
  fallbacks?: unknown;
};

describe('POST /api/suggest', () => {
  it('turns away a signed-out ask, before looking at the body', async () => {
    const response = await worker.fetch(post('/api/suggest', { nonsense: true }));
    expect(response.status).toBe(401);
  });

  it('rejects an ask without a meal type', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(post('/api/suggest', { ask: 'leeks' }, { cookie }));

    expect(response.status).toBe(400);
  });

  it('says so when there is no key to ask with', async () => {
    const { cookie } = await signUp();

    const response = await worker.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(409);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code: 'no_ai_key' });
  });

  it('returns three suggestions, with ids from the server and no images', async () => {
    fakeAnthropic({ replies: [OUTPUT] });
    const cookie = await signUpWithKey();

    const response = await worker.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(200);
    const { suggestions } = await response.json<SuggestResponse>();
    expect(suggestions.map(({ title }) => title)).toEqual(['One', 'Two', 'Three']);
    for (const { id, imageUrl } of suggestions) {
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(imageUrl).toBeNull();
    }
    expect(new Set(suggestions.map(({ id }) => id)).size).toBe(3);
  });

  it('asks the chosen model, with the base prompt, the meal type and the ask', async () => {
    const calls = fakeAnthropic({ replies: [OUTPUT] });
    const cookie = await signUpWithKey();

    await worker.fetch(post('/api/suggest', ASK, { cookie }));

    const [call] = messageCalls(calls);
    const sent = call?.body as SentMessage;
    expect(call?.apiKey).toBe(VALID_KEY);
    expect(sent.model).toBe('claude-test-newest');
    expect(sent.system).toBe(BASE_SYSTEM_PROMPT);
    expect(sent.messages).toEqual([{ role: 'user', content: expect.stringContaining('Dinner') }]);
    expect(sent.messages[0]?.content).toContain('something with leeks');
    expect(sent.output_config.format.type).toBe('json_schema');
    expect(sent.output_config.effort).toBe('low');
    expect(sent.fallbacks).toBe('default');
  });

  it('adds the likes & dislikes to the system prompt', async () => {
    const calls = fakeAnthropic({ replies: [OUTPUT] });
    const cookie = await signUpWithKey();
    await worker.fetch(
      patch('/api/preferences', { recipePreferences: 'No mushrooms, ever.' }, { cookie }),
    );

    await worker.fetch(post('/api/suggest', ASK, { cookie }));

    const sent = messageCalls(calls)[0]?.body as SentMessage;
    expect(sent.system.startsWith(BASE_SYSTEM_PROMPT)).toBe(true);
    expect(sent.system).toContain('No mushrooms, ever.');
  });

  it('leaves effort alone for a model that does not take it', async () => {
    const calls = fakeAnthropic({
      models: [{ id: 'claude-test-no-effort', lowEffort: false }],
      replies: [OUTPUT],
    });
    const cookie = await signUpWithKey();

    await worker.fetch(post('/api/suggest', ASK, { cookie }));

    const sent = messageCalls(calls)[0]?.body as SentMessage;
    expect(sent.output_config.effort).toBeUndefined();
  });

  it.each([
    ['out of shape', SHORT_OUTPUT],
    ['cut off', () => messageResponse(OUTPUT, 'max_tokens')],
  ])('tries once more when the reply is %s', async (_, first) => {
    const calls = fakeAnthropic({ replies: [first, OUTPUT] });
    const cookie = await signUpWithKey();

    const response = await worker.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(200);
    expect(messageCalls(calls)).toHaveLength(2);
  });

  it('gives up after a second reply out of shape', async () => {
    const calls = fakeAnthropic({ replies: [SHORT_OUTPUT] });
    const cookie = await signUpWithKey();

    const response = await worker.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(502);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code: 'ai_bad_output' });
    expect(messageCalls(calls)).toHaveLength(2);
  });

  it('does not retry a refusal', async () => {
    const calls = fakeAnthropic({ replies: [() => messageResponse({}, 'refusal')] });
    const cookie = await signUpWithKey();

    const response = await worker.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(422);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code: 'ai_refused' });
    expect(messageCalls(calls)).toHaveLength(1);
  });

  it.each([
    ['a rejected key', 401, 'authentication_error', 422, 'ai_key_invalid'],
    ['a missing model', 404, 'not_found_error', 409, 'ai_model_unavailable'],
    ['a rate limit', 429, 'rate_limit_error', 429, 'ai_rate_limited'],
    ['an overload', 529, 'overloaded_error', 503, 'ai_unavailable'],
    ['a server error', 500, 'api_error', 503, 'ai_unavailable'],
  ])('turns %s into a code the client can act on', async (_, status, type, expected, code) => {
    fakeAnthropic({ replies: [() => errorResponse(status, type, 'from the provider')] });
    const cookie = await signUpWithKey();

    const response = await worker.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(expected);
    await expect(response.json<ApiErrorBody>()).resolves.toMatchObject({ code });
  });

  it("passes on the provider's reason for refusing the request", async () => {
    fakeAnthropic({
      replies: [
        () => errorResponse(400, 'invalid_request_error', 'Your credit balance is too low'),
      ],
    });
    const cookie = await signUpWithKey();

    const response = await worker.fetch(post('/api/suggest', ASK, { cookie }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: 'Your credit balance is too low',
      code: 'ai_rejected',
    });
  });
});
