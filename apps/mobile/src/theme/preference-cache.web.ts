import { parseCachedAppearance, type CachedAppearance, CACHE_KEY } from './preference-cache.shared';

export type { CachedAppearance } from './preference-cache.shared';

/**
 * The web half of ./preference-cache.ts, on localStorage. Only ever loaded on
 * web, so the globals need no Platform guard. Storage can still throw - private
 * modes and blocked site data - hence the try/catch.
 */
export function readCachedAppearance(): CachedAppearance | null {
  try {
    return parseCachedAppearance(window.localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

export function writeCachedAppearance(appearance: CachedAppearance): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(appearance));
  } catch {
    // A cache that cannot be written costs one flash on the next load.
  }
}
