/**
 * Error codes the client can act on. A response without one is just a status,
 * and the client treats it as a generic failure.
 */
export const API_ERROR_CODES = [
  /** No API key is stored, so there is nothing to ask the model with. */
  'no_ai_key',
  /** The provider turned the stored key down. */
  'ai_key_invalid',
  /** The key works, but none of its models can return structured output. */
  'ai_no_models',
  /** The chosen model is gone, or the key cannot use it. */
  'ai_model_unavailable',
  /** The provider refused the request itself - a spent credit balance, say. */
  'ai_rejected',
  'ai_rate_limited',
  'ai_unavailable',
  /** The model declined the ask. */
  'ai_refused',
  /** The model answered twice with something that did not fit the schema. */
  'ai_bad_output',
  /** The role is the admin's own, or set by `ADMIN_EMAILS`. */
  'role_locked',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Every error the API sends. `error` is for people, `code` for the client. */
export type ApiErrorBody = {
  error: string;
  code?: ApiErrorCode;
};
