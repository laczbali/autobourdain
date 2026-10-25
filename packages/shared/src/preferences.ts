import { z } from 'zod';

/** The palettes the app ships. Each one has a light and a dark set. */
export const THEMES = ['cocoa-plum', 'warm-ink'] as const;
export type ThemeName = (typeof THEMES)[number];

/** What the user picks for light or dark. `system` follows the OS. */
export const MODES = ['light', 'dark', 'system'] as const;
export type Mode = (typeof MODES)[number];

/** How long the likes & dislikes text may be, in characters. */
export const RECIPE_PREFERENCES_MAX = 2000;

/**
 * Every preference a user can store, and what each one may hold.
 *
 * The table behind it is key-value, so this is the only place that decides
 * which keys exist and what their values look like - the database checks
 * neither. Adding a preference is an entry here and one in the defaults below,
 * with no migration.
 */
export const preferencesSchema = z.object({
  theme: z.enum(THEMES),
  mode: z.enum(MODES),
  /**
   * Likes & dislikes, in the user's own words. Added to every suggest prompt,
   * after the app's own instructions.
   */
  recipePreferences: z.string().trim().max(RECIPE_PREFERENCES_MAX),
});

export type Preferences = z.infer<typeof preferencesSchema>;
export type PreferenceKey = keyof Preferences;

/** What a user gets for every key they have never set. */
export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'cocoa-plum',
  mode: 'system',
  recipePreferences: '',
};

/**
 * The body of `PATCH /api/preferences`: any subset of the keys, each with a
 * valid value. Unknown keys and `null` are rejected rather than ignored.
 */
export const preferencesPatchSchema = preferencesSchema.partial().strict();

export type PreferencesPatch = z.infer<typeof preferencesPatchSchema>;
