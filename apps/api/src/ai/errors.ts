/**
 * The ways a provider call can fail, as far as the rest of the API cares.
 * Every adapter turns its SDK's errors into one of these, so nothing outside
 * `src/ai` has to know which provider it is talking to.
 */
export type AiErrorCode =
  | 'key_invalid'
  /** The key works, but none of its models can return structured output. */
  | 'no_models'
  | 'model_unavailable'
  | 'rejected'
  | 'rate_limited'
  | 'unavailable'
  | 'refused'
  | 'bad_output';

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AiError';
  }
}
