import type { Href } from 'expo-router';

/**
 * The settings categories, grouped as `d5b` groups them, in rail order.
 *
 * Only what is built is listed. `d5b` also draws Household and Planning rules
 * under Preferences, and a Setup group (Meal types, Kitchen defaults); each
 * gets its line here when it is built, and not before. Adding one is a file
 * under `app/(shell)/settings` plus a line here.
 *
 * Likes & dislikes stands where `d5b` has Diet & avoid, as free text rather
 * than lists. AI and Admin are not in `d5b` at all.
 */
export const SETTINGS_GROUPS = [
  {
    label: 'Preferences',
    sections: [{ href: '/settings/likes-and-dislikes', label: 'Likes & dislikes' }],
  },
  {
    label: 'App',
    sections: [
      { href: '/settings/appearance', label: 'Appearance' },
      { href: '/settings/ai', label: 'AI' },
      { href: '/settings/account', label: 'Account' },
    ],
  },
  {
    label: 'Admin',
    sections: [{ href: '/settings/admin/users', label: 'Users' }],
    adminOnly: true,
  },
] as const satisfies readonly {
  label: string;
  sections: readonly { href: Href; label: string }[];
  /** Hidden from everyone but admins. The API enforces it either way. */
  adminOnly?: boolean;
}[];
