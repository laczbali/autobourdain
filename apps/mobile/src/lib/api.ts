import type {
  HealthResponse,
  Preferences,
  PreferencesPatch,
  SuggestRequest,
  SuggestResponse,
} from '@autobourdain/shared';
import { Platform } from 'react-native';

import { authClient } from './auth-client';
import { API_URL } from './config';
import { mockSuggestMeals } from './suggest.mock';

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
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export const getHealth = () => apiFetch<HealthResponse>('/api/health');

export const getPreferences = () => apiFetch<Preferences>('/api/preferences');

export const patchPreferences = (patch: PreferencesPatch) =>
  apiFetch<Preferences>('/api/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

// Mocked until the endpoint exists. The real one is a POST of the request to
// `/api/suggest`, and nothing that calls this has to change.
export const suggestMeals = (request: SuggestRequest): Promise<SuggestResponse> =>
  mockSuggestMeals(request);
