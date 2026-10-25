import { preferencesSchema, type Preferences } from '@autobourdain/shared';

/** The part of the preferences the first paint depends on. */
export type CachedAppearance = Pick<Preferences, 'theme' | 'mode'>;

/** SecureStore keys allow letters, digits, `.`, `-` and `_` only. */
export const CACHE_KEY = 'autobourdain.appearance';

const appearanceSchema = preferencesSchema.pick({ theme: true, mode: true });

/**
 * Anything unreadable - no entry, broken JSON, a theme that has since been
 * removed - comes back as null, and the provider falls back to the defaults.
 */
export function parseCachedAppearance(raw: string | null): CachedAppearance | null {
  if (!raw) return null;
  try {
    const parsed = appearanceSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
