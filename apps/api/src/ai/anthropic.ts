import type { AiModel } from '@autobourdain/shared';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { AiError } from './errors';
import type { AiAccess, AiProviderAdapter, GenerateRequest } from './types';

/** Three full recipes fit comfortably. Non-streaming, so it stays modest. */
const MAX_TOKENS = 16000;

/** Enough for "OK" - the connection test pays for a handful of tokens, no more. */
const PING_MAX_TOKENS = 16;

/** Listing models is a call to Anthropic with the user's key, so it is kept a day. */
const MODELS_TTL_MS = 24 * 60 * 60 * 1000;

/** Per attempt. The SDK retries rate limits, overloads and dropped connections twice. */
const TIMEOUT_MS = 60_000;

/**
 * Which models take `effort: 'low'`, by id. Capabilities are the same for
 * every key, so this is per isolate rather than per user. Filled by
 * `listModels`, and on a miss by looking the one model up.
 */
const lowEffort = new Map<string, boolean>();

/** Anthropic always runs on the user's key, so a call without one is a bug here. */
function client({ apiKey }: AiAccess) {
  if (!apiKey) throw new Error("Anthropic needs the user's API key");
  return new Anthropic({ apiKey, timeout: TIMEOUT_MS });
}

export const anthropic: AiProviderAdapter = {
  modelsTtlMs: MODELS_TTL_MS,

  async listModels(access) {
    const models: AiModel[] = [];
    try {
      for await (const model of client(access).models.list({ limit: 100 })) {
        // Every model offered has to be able to return the suggest schema.
        if (!model.capabilities?.structured_outputs.supported) continue;
        lowEffort.set(model.id, model.capabilities.effort.low.supported);
        models.push({ id: model.id, label: model.display_name });
      }
    } catch (error) {
      throw toAiError(error);
    }
    return models;
  },

  async ping({ access, model }) {
    const api = client(access);
    try {
      const effort = (await supportsLowEffort(api, model)) ? { effort: 'low' as const } : {};
      // Any answer will do, cut off or not: getting one at all is the test.
      await api.messages.create({
        model,
        max_tokens: PING_MAX_TOKENS,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        output_config: effort,
      });
    } catch (error) {
      throw toAiError(error);
    }
  },

  async generate<T>({ access, model, system, prompt, schema }: GenerateRequest<T>) {
    const api = client(access);
    const format = zodOutputFormat(schema);

    let message: Anthropic.Beta.BetaMessage;
    try {
      const effort = (await supportsLowEffort(api, model)) ? { effort: 'low' as const } : {};
      message = await api.beta.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: prompt }],
        // `create` rather than `parse`, so a refusal or a cut-off reply is
        // seen for what it is before anything tries to parse it.
        output_config: { format, ...effort },
        // On a policy decline, Anthropic reruns the ask on its default
        // fallback model. Models without fallbacks just run alone.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    } catch (error) {
      throw toAiError(error);
    }

    if (message.stop_reason === 'refusal') {
      throw new AiError('refused', 'The model declined the ask');
    }
    if (message.stop_reason === 'max_tokens') {
      throw new AiError('bad_output', 'The reply was cut off');
    }

    // After a fallback the declined attempt's text can precede the answer.
    const text = message.content.filter((block) => block.type === 'text').at(-1);
    if (!text) throw new AiError('bad_output', 'The reply had no text');
    try {
      return format.parse(text.text);
    } catch (error) {
      throw new AiError('bad_output', 'The reply did not fit the schema', { cause: error });
    }
  },
};

async function supportsLowEffort(api: Anthropic, model: string): Promise<boolean> {
  const known = lowEffort.get(model);
  if (known !== undefined) return known;
  const info = await api.models.retrieve(model);
  const supported = info.capabilities?.effort.low.supported ?? false;
  lowEffort.set(model, supported);
  return supported;
}

function toAiError(error: unknown): unknown {
  if (error instanceof AiError) return error;
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new AiError('key_invalid', 'Anthropic did not accept the key', { cause: error });
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new AiError('model_unavailable', 'The model is not available', { cause: error });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError('rate_limited', 'Anthropic is rate limiting the key', { cause: error });
  }
  if (
    error instanceof Anthropic.BadRequestError ||
    error instanceof Anthropic.UnprocessableEntityError
  ) {
    return new AiError('rejected', providerMessage(error), { cause: error });
  }
  // Server errors, overloads, timeouts and connection failures.
  if (error instanceof Anthropic.APIError) {
    return new AiError('unavailable', 'Anthropic could not be reached', { cause: error });
  }
  // A bug on this side, not the provider's - left to surface as a 500.
  return error;
}

/** The human part of an API error body, which is what is worth showing. */
function providerMessage(error: InstanceType<typeof Anthropic.APIError>): string {
  const body = error.error as { error?: { message?: unknown } } | undefined;
  return typeof body?.error?.message === 'string' ? body.error.message : error.message;
}
