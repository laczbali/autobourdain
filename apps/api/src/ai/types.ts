import type { AiModel } from '@autobourdain/shared';
import type { z } from 'zod';

/**
 * How a call reaches its provider. A keyed provider reads the user's key, and
 * Workers AI reads the Worker's own binding instead - it has no key.
 */
export type AiAccess = {
  apiKey: string | null;
  ai: Ai;
};

export type GenerateRequest<T> = {
  access: AiAccess;
  model: string;
  /** The instructions, kept apart from the user turn by every provider. */
  system: string;
  /** The user turn. */
  prompt: string;
  /** What the reply must parse as. */
  schema: z.ZodType<T>;
};

/**
 * One provider. Adding a provider is one of these plus an entry in
 * `registry.ts` - nothing else in the API changes.
 *
 * Every method throws `AiError`, never the provider SDK's own errors.
 */
export interface AiProviderAdapter {
  /**
   * How long an answer from `listModels` is served from the database before
   * the provider is asked again. Zero when listing costs nothing.
   */
  readonly modelsTtlMs: number;
  /**
   * Every model the provider offers for structured output, in its own order.
   * For a keyed provider this doubles as the key check: a key the provider
   * turns down throws `key_invalid`.
   */
  listModels(access: AiAccess): Promise<AiModel[]>;
  /**
   * The smallest real request the model will take. Listing models can pass
   * while asking fails - an account without credit, say - so this is the
   * check that the account, its billing and the model all work together.
   */
  ping(request: { access: AiAccess; model: string }): Promise<void>;
  /** One structured answer, already parsed against the schema. */
  generate<T>(request: GenerateRequest<T>): Promise<T>;
}
