import { palettes } from './palettes';
import { THEMES, TOKENS, type ResolvedMode } from './tokens';

const MODES: ResolvedMode[] = ['light', 'dark'];

describe('palettes', () => {
  it.each(THEMES)('%s defines every token in both modes', (theme) => {
    for (const mode of MODES) {
      const palette = palettes[theme][mode];
      for (const token of TOKENS) {
        expect(palette[token]).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(Object.keys(palette).sort()).toEqual([...TOKENS].sort());
    }
  });

  it('keeps light and dark apart within a theme', () => {
    for (const theme of THEMES) {
      expect(palettes[theme].light).not.toEqual(palettes[theme].dark);
    }
  });

  it('keeps the two themes apart within a mode', () => {
    for (const mode of MODES) {
      expect(palettes['cocoa-plum'][mode]).not.toEqual(palettes['warm-ink'][mode]);
    }
  });

  // Text has to stay readable in both themes and both modes, so the palettes
  // are checked rather than eyeballed. 4.5:1 is WCAG AA for body text; the
  // backgrounds text can land on are canvas, raised and inset.
  it.each(THEMES)('%s keeps text, secondary and muted at AA on every surface', (theme) => {
    for (const mode of MODES) {
      const palette = palettes[theme][mode];
      for (const fg of ['text', 'secondary', 'muted'] as const) {
        expect(contrast(palette[fg], palette.canvas)).toBeGreaterThanOrEqual(4.5);
      }
      // Panels sit above the canvas, so they lose a little; secondary and text
      // still have to clear AA there.
      for (const bg of ['raised', 'inset'] as const) {
        expect(contrast(palette.text, palette[bg])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(palette.secondary, palette[bg])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(THEMES)('%s keeps on-accent legible on the accent', (theme) => {
    for (const mode of MODES) {
      const palette = palettes[theme][mode];
      // 3:1, the AA bar for the large bold text a primary button carries.
      expect(contrast(palette['on-accent'], palette.accent)).toBeGreaterThanOrEqual(3);
    }
  });
});

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
