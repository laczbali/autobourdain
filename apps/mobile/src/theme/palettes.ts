import { vars } from 'nativewind';

import { TOKENS, type Palette, type ResolvedMode, type ThemeName } from './tokens';

/**
 * The palettes, straight from the hi-fi passes in `design/`:
 * `2e-1` / `2e-1b` are Cocoa plum dark and light, `2e-2` / `2e-2b` Warm ink.
 *
 * Those frames name nine colours. The four extras the screens turned out to
 * need - `muted`, `control`, `rule` and `on-accent` - are taken from the `2e`
 * full-screen mock where it has them (Cocoa plum light), and derived elsewhere,
 * since no dark screen was ever drawn and Warm ink only exists as a palette
 * card. Every derived value is marked; they are the ones to check first if a
 * dark screen looks off.
 */
export const palettes: Record<ThemeName, Record<ResolvedMode, Palette>> = {
  'cocoa-plum': {
    dark: {
      canvas: '#1a1316',
      raised: '#1e1519',
      inset: '#241a1e',
      hairline: '#362a2f',
      rule: '#2c2126', // derived: one step up from `inset`
      control: '#46373c', // from the swatch border on the 2e-1 card
      accent: '#e07a52',
      'on-accent': '#1a1316', // derived: the accent is bright, so this is `canvas`
      text: '#f5e9e4',
      secondary: '#b09a93',
      muted: '#8f7c78', // derived: `secondary` pulled toward the canvas, kept at 4.5:1
      'in-stock': '#9ec79b',
      'to-buy': '#dba97f',
    },
    light: {
      canvas: '#faf4f0',
      raised: '#f3e9e3',
      inset: '#ece0d9',
      hairline: '#ded0c8',
      rule: '#e7dad3',
      control: '#cbb9af',
      accent: '#bd5227',
      'on-accent': '#ece0d9',
      text: '#2a1d20',
      secondary: '#6f5b53',
      muted: '#80695f',
      'in-stock': '#3f6e3c',
      'to-buy': '#8a5c1f',
    },
  },
  'warm-ink': {
    dark: {
      canvas: '#181311',
      raised: '#1e1815',
      inset: '#261e1a',
      hairline: '#352a25',
      rule: '#2d241f', // derived: one step up from `inset`
      control: '#463830', // derived: one step up from `hairline`
      accent: '#e2543f',
      'on-accent': '#181311', // derived: the accent is bright, so this is `canvas`
      text: '#f3e8e0',
      secondary: '#ab968c',
      muted: '#8e7c73', // derived: `secondary` pulled toward the canvas, kept at 4.5:1
      'in-stock': '#a6bd84',
      'to-buy': '#ddab72',
    },
    light: {
      canvas: '#faf6f3',
      raised: '#f2ebe6',
      inset: '#eae1db',
      hairline: '#dbd0c9',
      rule: '#e7ded7', // derived: between `raised` and `hairline`
      control: '#c8b9b0', // derived: one step down from `hairline`
      accent: '#c2381f',
      'on-accent': '#eae1db', // derived: `inset`, matching what 2e does with the accent
      text: '#221a17',
      secondary: '#6b5a52',
      muted: '#7c685e', // derived: `secondary` lightened, as 2e does for Cocoa plum
      'in-stock': '#456c36',
      'to-buy': '#815718',
    },
  },
};

/**
 * Tailwind maps every token through `rgb(var(--token) / <alpha-value>)`, which
 * needs the channels apart so `bg-raised/60` still works. Hex is what the
 * design frames speak, so the split happens here rather than in the palettes.
 */
function channels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function toVars(palette: Palette) {
  return vars(Object.fromEntries(TOKENS.map((token) => [`--${token}`, channels(palette[token])])));
}

/**
 * The same palettes as NativeWind variable objects, built once at module load
 * - the provider only has to pick one.
 */
export const paletteVars: Record<ThemeName, Record<ResolvedMode, ReturnType<typeof toVars>>> = {
  'cocoa-plum': {
    dark: toVars(palettes['cocoa-plum'].dark),
    light: toVars(palettes['cocoa-plum'].light),
  },
  'warm-ink': {
    dark: toVars(palettes['warm-ink'].dark),
    light: toVars(palettes['warm-ink'].light),
  },
};
