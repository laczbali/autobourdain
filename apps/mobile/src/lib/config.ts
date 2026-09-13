import { Platform } from 'react-native';

/**
 * In production the app is served by the same Worker that hosts the API, so the
 * base URL is just the current origin. In development the Expo dev server and
 * `wrangler dev` are on different ports, so EXPO_PUBLIC_API_URL points at the
 * Worker (see .env.development). Native builds always need it set explicitly.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  (Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:8787');

/**
 * Turnstile site key. Public by design - it is baked into the web bundle at
 * export time, which is why it lives in .env.development / .env.production
 * rather than in wrangler.jsonc or the dashboard. The matching secret is a
 * Worker secret; see apps/api/src/auth.ts.
 */
export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
