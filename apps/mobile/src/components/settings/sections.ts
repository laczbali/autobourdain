import type { Href } from 'expo-router';

/**
 * The settings categories, grouped as `d5b` groups them, in rail order.
 *
 * Only what is built is listed. `d5b` also draws Preferences (Household, Diet
 * & avoid, Planning rules) and Setup (Meal types, Kitchen defaults); each gets
 * its group and its line here when it is built, and not before. Adding one is a
 * file under `app/(shell)/settings` plus a line here.
 */
export const SETTINGS_GROUPS = [
  {
    label: 'App',
    sections: [
      { href: '/settings/appearance', label: 'Appearance' },
      { href: '/settings/account', label: 'Account' },
    ],
  },
] as const satisfies readonly {
  label: string;
  sections: readonly { href: Href; label: string }[];
}[];
