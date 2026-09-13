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
