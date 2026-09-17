/**
 * The token contract.
 *
 * A theme is a set of values for these names, not a set of classNames: every
 * colour a screen can use is one of them, and the palettes in ./palettes.ts
 * fill them in for each theme and mode. Adding a colour means adding a token
 * here and a value in all four palettes - the types make the second half
 * unskippable.
 *
 * Each token reaches Tailwind as a CSS variable of the same name, mapped in
 * tailwind.config.js, so `bg-canvas`, `text-secondary` and `border-hairline`
 * work in either mode without a single `dark:` variant.
 */
export const TOKENS = [
  'canvas', // page background
  'raised', // panels and cards sitting on the canvas
  'inset', // fields and wells sitting in a panel
  'hairline', // structural borders and dividers
  'rule', // the lighter divider between rows of a list
  'control', // the border of an interactive control
  'accent', // the one saturated colour: primary actions, links, emphasis
  'on-accent', // text and icons drawn on top of `accent`
  'text', // primary text
  'secondary', // supporting text and labels
  'muted', // tertiary text: captions, timestamps, asides
  'in-stock', // an ingredient already in the kitchen
  'to-buy', // an ingredient that has to be bought
] as const;

export type Token = (typeof TOKENS)[number];

/** A single theme's colours in one mode, as hex. */
export type Palette = Record<Token, string>;

export const THEMES = ['cocoa-plum', 'warm-ink'] as const;
export type ThemeName = (typeof THEMES)[number];

/** What the user picks. `system` follows the OS. */
export type Mode = 'light' | 'dark' | 'system';
/** What `system` resolves to, and what a palette is actually chosen by. */
export type ResolvedMode = 'light' | 'dark';

/** Names for the theme picker in Settings (block 3). */
export const THEME_LABELS: Record<ThemeName, string> = {
  'cocoa-plum': 'Cocoa plum',
  'warm-ink': 'Warm ink',
};

/**
 * The type scale, in one place so the primitives stay thin and a screen never
 * picks a size by hand. Newsreader carries headings and numbers, DM Sans the
 * UI and body - the pairing from the hi-fi passes in `design/`.
 */
export const typeScale = {
  wordmark: 'font-display text-[24px] leading-none',
  h1: 'font-display text-[28px] leading-[1.1]',
  h2: 'font-display text-[22px] leading-[1.15]',
  h3: 'font-display text-[17px] leading-[1.2]',
  numeral: 'font-display text-[20px] leading-none',
  body: 'font-sans text-[13px] leading-[1.45]',
  bodyLarge: 'font-sans text-[15px] leading-[1.45]',
  label: 'font-sans-medium text-[12.5px] leading-[1.3]',
  caption: 'font-sans text-[11.5px] leading-[1.3]',
  eyebrow: 'font-sans text-[11px] uppercase tracking-[0.06em] leading-[1.2]',
  nav: 'font-sans text-[13px] leading-[1.3]',
  navCurrent: 'font-sans-medium text-[13px] leading-[1.3]',
  button: 'font-sans-bold text-[13px] leading-none',
} as const;

export type TypeRole = keyof typeof typeScale;
