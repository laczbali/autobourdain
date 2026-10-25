import type { AiModel } from '@autobourdain/shared';
import { z } from 'zod';

import { AiError } from './errors';
import type { AiProviderAdapter } from './types';

/**
 * Workers AI, through the Worker's `AI` binding. It runs on the app's own
 * Cloudflare account, so there is no key, and every call is billed to the app.
 */

/** Three full recipes fit comfortably, inside the smaller models' context too. */
const MAX_TOKENS = 8192;

/** Enough for "OK" - the connection test should cost next to nothing. */
const PING_MAX_TOKENS = 16;

/** Per attempt, as for Anthropic. A retried ask can take up to twice this. */
const TIMEOUT_MS = 60_000;

/**
 * The Workers AI models on offer, the first being the default. Picked by hand,
 * because Cloudflare has no list of the models that reliably answer in JSON
 * mode - each one here has been tried against real asks.
 */
export const WORKERS_AI_MODELS: AiModel[] = [
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B (default, balanced)' },
  { id: '@cf/openai/gpt-oss-120b', label: 'GPT-OSS 120B (most varied, slowest)' },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B (fastest, plainest)' },
];

export const workersAi: AiProviderAdapter = {
  // The list is the one above, so a stored copy would only hide models added
  // to it since.
  modelsTtlMs: 0,

  async listModels() {
    return WORKERS_AI_MODELS;
  },

  async ping({ access, model }) {
    await run(access.ai, model, {
      messages: [{ role: 'user', content: 'Reply with OK.' }],
      max_tokens: PING_MAX_TOKENS,
    });
  },

  async generate({ access, model, system, prompt, schema }) {
    const result = await run(access.ai, model, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_schema', json_schema: z.toJSONSchema(schema) },
      max_tokens: MAX_TOKENS,
    });

    let output = replyOf(result);
    if (output === undefined) throw new AiError('bad_output', 'The reply had no text');
    // JSON mode usually hands the reply back parsed, but not on every model.
    if (typeof output === 'string') {
      try {
        output = JSON.parse(output);
      } catch (error) {
        throw new AiError('bad_output', 'The reply was not JSON', { cause: error });
      }
    }

    const parsed = schema.safeParse(output);
    if (!parsed.success) {
      throw new AiError('bad_output', 'The reply did not fit the schema', { cause: parsed.error });
    }
    return parsed.data;
  },
};

async function run(ai: Ai, model: string, inputs: Record<string, unknown>): Promise<unknown> {
  try {
    return await ai.run(model, inputs, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw toAiError(error);
  }
}

/**
 * The answer, from either shape a text model replies in: Workers AI's own
 * `{ response }`, or an OpenAI-style chat completion.
 */
function replyOf(result: unknown): unknown {
  if (typeof result === 'string') return result;
  if (typeof result !== 'object' || result === null) return undefined;
  if ('response' in result) return result.response ?? undefined;
  if ('choices' in result && Array.isArray(result.choices)) {
    const choice: unknown = result.choices[0];
    if (typeof choice === 'object' && choice !== null && 'message' in choice) {
      const message = choice.message;
      if (typeof message === 'object' && message !== null && 'content' in message) {
        return message.content ?? undefined;
      }
    }
  }
  return undefined;
}

/**
 * The binding throws plain errors whose message carries Workers AI's internal
 * code - see https://developers.cloudflare.com/workers-ai/platform/errors/.
 */
function toAiError(error: unknown): AiError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("JSON Mode couldn't be met")) {
    return new AiError('bad_output', 'The reply did not fit the schema', { cause: error });
  }

  const code = /\b(\d{4})\b/.exec(message)?.[1];
  switch (code) {
    // No such model, invalid model id.
    case '5007':
    case '3042':
      return new AiError('model_unavailable', 'The model is not available', { cause: error });
    case '3036':
      return new AiError('rejected', "The app's Workers AI allowance for today is used up", {
        cause: error,
      });
    // Account blocked, model not allowed, terms not agreed, needs Workers Paid.
    case '3023':
    case '3041':
    case '5016':
    case '5018':
    case '5035':
      return new AiError('rejected', 'Workers AI will not run this model for the app', {
        cause: error,
      });
    case '3040':
      return new AiError('rate_limited', 'Workers AI is out of capacity', { cause: error });
    default:
      // Timeouts - ours from TIMEOUT_MS included - aborts and anything
      // unknown: everything thrown here came from the call, not this side.
      return new AiError('unavailable', 'Workers AI could not be reached', { cause: error });
  }
}
