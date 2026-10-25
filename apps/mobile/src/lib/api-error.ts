import type { ApiErrorCode } from '@autobourdain/shared';

/**
 * A failed API call. `code` is set when the server gave one, and is what the
 * screens branch on - the message is for people.
 *
 * Its own module, so a test that mocks the API calls still has the real class.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: ApiErrorCode,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The code of an error, when it is an `ApiError` that has one. */
export function errorCode(error: unknown): ApiErrorCode | undefined {
  return error instanceof ApiError ? error.code : undefined;
}
