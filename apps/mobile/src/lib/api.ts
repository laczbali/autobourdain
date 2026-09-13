import type { HealthResponse } from '@autobourdain/shared';
import { Platform } from 'react-native';

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
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export const getHealth = () => apiFetch<HealthResponse>('/api/health');
