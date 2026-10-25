import type { AiModel } from '@autobourdain/shared';
import type { z } from 'zod';

export type GenerateRequest<T> = {
  apiKey: string;
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
 * Both methods throw `AiError`, never the provider SDK's own errors.
 */
export interface AiProviderAdapter {
  /**
   * Every model the key can use for structured output, in the provider's own
   * order. Doubles as the key check: a key the provider turns down throws
   * `key_invalid`.
   */
  listModels(apiKey: string): Promise<AiModel[]>;
  /** One structured answer, already parsed against the schema. */
  generate<T>(request: GenerateRequest<T>): Promise<T>;
}
