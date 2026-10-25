import type { Ingredient } from '@autobourdain/shared';

/** The quarters worth writing as a fraction. */
const FRACTIONS: Record<number, string> = { 0.25: '1/4', 0.5: '1/2', 0.75: '3/4' };

/**
 * Rounds a scaled quantity to something a cook would measure. Large amounts go
 * to the nearest 5, mid-sized ones to a whole number, small ones to a quarter.
 * Counted things with no unit - eggs, onions - go to a half, since a quarter of
 * an egg is not a thing anyone measures. Nothing rounds down to zero.
 */
export function roundQuantity(value: number, unit: string | null): number {
  if (value >= 100) return Math.round(value / 5) * 5;
  if (value >= 10) return Math.round(value);
  const step = unit === null ? 0.5 : 0.25;
  return Math.max(step, Math.round(value / step) * step);
}

/** Writes a rounded quantity, with any quarter as a fraction: `1 1/2`, `3/4`. */
export function formatNumber(value: number): string {
  const whole = Math.floor(value);
  const fraction = FRACTIONS[value - whole];
  if (!fraction) return String(value);
  return whole === 0 ? fraction : `${whole} ${fraction}`;
}

/**
 * What goes on the right of an ingredient row, for `portions` rather than the
 * recipe's own `basePortions`. Unmeasured ingredients keep their wording.
 */
export function formatIngredientAmount(
  ingredient: Ingredient,
  basePortions: number,
  portions: number,
): string {
  const { quantity, unit } = ingredient;
  if (quantity === null) return unit ?? '';

  const scaled = roundQuantity((quantity * portions) / basePortions, unit);
  return unit ? `${formatNumber(scaled)} ${unit}` : formatNumber(scaled);
}
