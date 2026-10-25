import type {
  AiKey,
  AiKeyPatch,
  AiKeyPut,
  AiKeyResponse,
  AiKeyTestResponse,
  AiModelsResponse,
  ApiErrorBody,
  HealthResponse,
  Preferences,
  PreferencesPatch,
  SuggestRequest,
  SuggestResponse,
} from '@autobourdain/shared';
import { Platform } from 'react-native';

import { ApiError } from './api-error';
import { authClient } from './auth-client';
import { API_URL } from './config';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');

  // On web the session rides along as a cookie. On native better-auth keeps the
  // session in SecureStore, so it has to be attached by hand.
  if (Platform.OS !== 'web') {
    const cookie = await authClient.getCookie();
    if (cookie) headers.set('Cookie', cookie);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    // The API answers errors with an ApiErrorBody. Anything else - a proxy's
    // HTML page, say - still fails, just without a code.
    const body = (await response.json().catch(() => null)) as Partial<ApiErrorBody> | null;
    throw new ApiError(
      response.status,
      body?.error ?? `${init?.method ?? 'GET'} ${path} failed: ${response.status}`,
      body?.code,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** A request carrying a JSON body. */
function withJson(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const getHealth = () => apiFetch<HealthResponse>('/api/health');

export const getPreferences = () => apiFetch<Preferences>('/api/preferences');

export const patchPreferences = (patch: PreferencesPatch) =>
  apiFetch<Preferences>('/api/preferences', withJson('PATCH', patch));

export const getAiKey = () => apiFetch<AiKeyResponse>('/api/ai-key');

export const putAiKey = (body: AiKeyPut) => apiFetch<AiKey>('/api/ai-key', withJson('PUT', body));

export const patchAiKey = (body: AiKeyPatch) =>
  apiFetch<AiKey>('/api/ai-key', withJson('PATCH', body));

export const deleteAiKey = () => apiFetch<void>('/api/ai-key', { method: 'DELETE' });

/** The cached list, unless `refresh` asks the provider again. */
export const getAiModels = (refresh = false) =>
  apiFetch<AiModelsResponse>(`/api/ai-key/models${refresh ? '?refresh=true' : ''}`);

export const testAiKey = () => apiFetch<AiKeyTestResponse>('/api/ai-key/test', { method: 'POST' });

export const suggestMeals = (request: SuggestRequest) =>
  apiFetch<SuggestResponse>('/api/suggest', withJson('POST', request));
