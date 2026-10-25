import type { ApiErrorBody, ApiErrorCode } from '@autobourdain/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { AiError, AiErrorCode } from './errors';

const RESPONSES: Record<
  AiErrorCode,
  { status: ContentfulStatusCode; code: ApiErrorCode; error: string }
> = {
  key_invalid: { status: 422, code: 'ai_key_invalid', error: 'The API key was not accepted' },
  no_models: { status: 422, code: 'ai_no_models', error: 'The API key has no usable models' },
  model_unavailable: {
    status: 409,
    code: 'ai_model_unavailable',
    error: 'The chosen model is not available',
  },
  // Replaced by the provider's own message, which says what is wrong.
  rejected: { status: 422, code: 'ai_rejected', error: 'The provider refused the request' },
  rate_limited: { status: 429, code: 'ai_rate_limited', error: 'The provider is rate limiting' },
  unavailable: { status: 503, code: 'ai_unavailable', error: 'The provider could not be reached' },
  refused: { status: 422, code: 'ai_refused', error: 'The model declined the ask' },
  bad_output: { status: 502, code: 'ai_bad_output', error: 'The model answered out of shape' },
};

/** The response an `AiError` becomes, wherever in the API it is thrown. */
export function aiErrorResponse(error: AiError): {
  status: ContentfulStatusCode;
  body: ApiErrorBody;
} {
  const { status, code, error: message } = RESPONSES[error.code];
  return {
    status,
    body: { error: error.code === 'rejected' ? error.message : message, code },
  };
}
