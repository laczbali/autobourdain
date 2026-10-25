import { afterEach, vi } from 'vitest';

/**
 * A stand-in for api.anthropic.com, so no test needs a real key or spends
 * anything. The Worker runs in the same isolate as the tests, so spying on the
 * global fetch catches the SDK's calls. Every other host - Turnstile, say -
 * still goes out for real.
 */

export const VALID_KEY = 'sk-ant-test-valid-key-abcd';

// Taken before any spy, so a second fake in one test still reaches the network.
const realFetch = globalThis.fetch;

type FakeModel = { id: string; structured?: boolean; lowEffort?: boolean };

/**
 * A reply to `POST /v1/messages`: a body to answer with, or a function making
 * a whole Response. A function, because Workers will not let one request read
 * a body made while handling another.
 */
export type Reply = unknown;

export type Call = { method: string; path: string; apiKey: string | null; body: unknown };

type Options = {
  models?: FakeModel[];
  /** Answered in order, the last one repeating. */
  replies?: Reply[];
};

export const DEFAULT_MODELS: FakeModel[] = [
  { id: 'claude-test-newest' },
  { id: 'claude-test-older' },
];

/** Starts the fake, which stays up until the test ends. Returns every call it saw. */
export function fakeAnthropic({ models = DEFAULT_MODELS, replies = [] }: Options = {}): Call[] {
  const calls: Call[] = [];
  let replyIndex = 0;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname !== 'api.anthropic.com') return realFetch(input, init);

    const body = request.method === 'GET' ? undefined : await request.json();
    // SDK 1.x sends the key as a bearer token rather than in x-api-key.
    const apiKey =
      request.headers.get('authorization')?.replace(/^Bearer /, '') ??
      request.headers.get('x-api-key');
    calls.push({ method: request.method, path: url.pathname, apiKey, body });

    if (apiKey !== VALID_KEY) {
      return errorResponse(401, 'authentication_error', 'invalid x-api-key');
    }

    if (request.method === 'GET' && url.pathname === '/v1/models') {
      const data = models.map(modelInfo);
      return Response.json({
        data,
        has_more: false,
        first_id: data[0]?.id ?? null,
        last_id: data.at(-1)?.id ?? null,
      });
    }

    const one = /^\/v1\/models\/(.+)$/.exec(url.pathname);
    if (request.method === 'GET' && one) {
      const model = models.find(({ id }) => id === one[1]);
      return model
        ? Response.json(modelInfo(model))
        : errorResponse(404, 'not_found_error', 'model not found');
    }

    if (request.method === 'POST' && url.pathname === '/v1/messages') {
      const reply = replies[Math.min(replyIndex++, replies.length - 1)];
      return typeof reply === 'function'
        ? (reply as () => Response)()
        : Response.json(message(reply));
    }

    return errorResponse(404, 'not_found_error', `no fake for ${request.method} ${url.pathname}`);
  });

  return calls;
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * An API error as Anthropic sends one. `x-should-retry: false` stops the SDK's
 * own retries, which would otherwise back off for seconds.
 */
export function errorResponse(status: number, type: string, message: string): Response {
  return Response.json(
    { type: 'error', error: { type, message } },
    { status, headers: { 'x-should-retry': 'false' } },
  );
}

/** A finished message whose text is `output` as JSON - what structured output returns. */
export function message(
  output: unknown,
  { stopReason = 'end_turn' }: { stopReason?: string } = {},
): unknown {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-test-newest',
    content: [{ type: 'text', text: JSON.stringify(output) }],
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

/** A whole message Response, for stop reasons other than a clean finish. */
export function messageResponse(output: unknown, stopReason: string): Response {
  return Response.json(message(output, { stopReason }));
}

function modelInfo({ id, structured = true, lowEffort = true }: FakeModel) {
  const supported = (value: boolean) => ({ supported: value });
  return {
    id,
    type: 'model',
    display_name: `Display ${id}`,
    created_at: '2026-01-01T00:00:00Z',
    max_input_tokens: 200000,
    max_tokens: 64000,
    capabilities: {
      structured_outputs: supported(structured),
      effort: {
        supported: lowEffort,
        low: supported(lowEffort),
        medium: supported(lowEffort),
        high: supported(lowEffort),
        max: supported(lowEffort),
      },
    },
  };
}
