import type { Href } from 'expo-router';

/**
 * The shell's destinations, in rail order.
 *
 * One list drives both halves of the navigator: the triggers the tab router is
 * built from in `app/(shell)/_layout.tsx`, and the rows the sidebar renders.
 * Adding a destination is a file under `app/(shell)` plus a line here.
 *
 * `name` is the router's handle for the tab and never reaches the screen;
 * `label` is what the rail says. The wireframes write the middle two as "My
 * kitchen" and "My recipes" - the shorter words are a deliberate choice, noted
 * in the README.
 */
export const DESTINATIONS = [
  { name: 'today', href: '/', label: 'Today' },
  { name: 'week', href: '/week', label: 'Week plan' },
  { name: 'kitchen', href: '/kitchen', label: 'Kitchen' },
  { name: 'recipes', href: '/recipes', label: 'Recipes' },
  { name: 'settings', href: '/settings', label: 'Settings' },
] as const satisfies readonly { name: string; href: Href; label: string }[];

export type Destination = (typeof DESTINATIONS)[number];
