import type {
  AdminUser,
  AdminUsersResponse,
  AiActivate,
  AiKeyPut,
  AiModelPatch,
  AiModelsResponse,
  AiSettings,
  AiTestResponse,
  ApiErrorBody,
  HealthResponse,
  KeyedAiProvider,
  Preferences,
  PreferencesPatch,
  RoleUpdate,
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

export const getAiSettings = () => apiFetch<AiSettings>('/api/ai');

export const putAiActive = (body: AiActivate) =>
  apiFetch<AiSettings>('/api/ai', withJson('PUT', body));

export const patchAiModel = (body: AiModelPatch) =>
  apiFetch<AiSettings>('/api/ai', withJson('PATCH', body));

export const putAiKey = (body: AiKeyPut) =>
  apiFetch<AiSettings>('/api/ai-key', withJson('PUT', body));

export const deleteAiKey = (provider: KeyedAiProvider) =>
  apiFetch<void>(`/api/ai-key/${provider}`, { method: 'DELETE' });

/** The active provider's cached list, unless `refresh` asks it again. */
export const getAiModels = (refresh = false) =>
  apiFetch<AiModelsResponse>(`/api/ai/models${refresh ? '?refresh=true' : ''}`);

export const testAi = () => apiFetch<AiTestResponse>('/api/ai/test', { method: 'POST' });

export const suggestMeals = (request: SuggestRequest) =>
  apiFetch<SuggestResponse>('/api/suggest', withJson('POST', request));

export const getAdminUsers = () => apiFetch<AdminUsersResponse>('/api/admin/users');

export const patchUserRole = (id: string, body: RoleUpdate) =>
  apiFetch<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, withJson('PATCH', body));
