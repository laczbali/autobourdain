import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Where `wrangler dev` listens. The same port wrangler.jsonc serves on. */
const DEV_API_PORT = 8787;

/**
 * In development the app and the API are two servers on one machine, so the API
 * is that machine's host with the Worker's port on it. Which host that is
 * depends on where the app is running, and both answers are already to hand: a
 * browser has the URL it was served from, and Expo knows the dev server it
 * pulled the bundle from - `hostUri` is "192.168.0.16:8081" for a phone on the
 * same network as Metro. Deriving it is what saves every machine from writing
 * its own LAN address into a config file.
 */
function devApiUrl(): string | undefined {
  if (!__DEV__) return undefined;

  const host =
    Platform.OS === 'web'
      ? typeof window !== 'undefined'
        ? window.location.hostname
        : undefined
      : // "host:port", and only the host is wanted.
        Constants.expoConfig?.hostUri?.split(':')[0];

  return host ? `http://${host}:${DEV_API_PORT}` : undefined;
}

/**
 * Base URL for the API. EXPO_PUBLIC_API_URL wins wherever it is set: it is how
 * a device gets pointed at a deployed origin, and how a native release build
 * has to be configured, having neither a dev server nor a `window.location` to
 * fall back to. Failing that, development derives it from wherever the app came
 * from, and production is same-origin - one Worker serves the app and the API.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  devApiUrl() ||
  (Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : `http://localhost:${DEV_API_PORT}`);

/**
 * Turnstile site key. Public by design - it is baked into the web bundle at
 * export time, which is why it lives in .env.development / .env.production
 * rather than in wrangler.jsonc or the dashboard. The matching secret is a
 * Worker secret; see apps/api/src/auth.ts. Native does not use this: it loads
 * the widget from the Worker's own /api/turnstile page, which carries the key
 * wrangler.jsonc gives it.
 */
export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
