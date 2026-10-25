import * as SecureStore from 'expo-secure-store';

import { parseCachedAppearance, type CachedAppearance, CACHE_KEY } from './preference-cache.shared';

export type { CachedAppearance } from './preference-cache.shared';

/**
 * The last applied theme and mode, on this device.
 *
 * Read synchronously on purpose: the ThemeProvider takes its first state from
 * here, and an async read would paint the defaults first. SecureStore's sync
 * API blocks the JS thread, which for one short value at startup is the point.
 */
export function readCachedAppearance(): CachedAppearance | null {
  try {
    return parseCachedAppearance(SecureStore.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

export function writeCachedAppearance(appearance: CachedAppearance): void {
  try {
    SecureStore.setItem(CACHE_KEY, JSON.stringify(appearance));
  } catch {
    // A cache that cannot be written costs one flash on the next launch.
  }
}
