/**
 * Mass-unit model and conversions. Pure, platform-free. This is the single
 * source of truth for how grams, kilograms, and pounds relate — every price or
 * quantity conversion in the app funnels through here so the math stays exact
 * and consistent (no ad-hoc 2.2 multipliers scattered around the codebase).
 */

export type MassUnit = 'g' | 'kg' | 'lb';

/** Grams per one of each mass unit. 1 lb = 453.592 g (avoirdupois). */
export const GRAMS_PER: Record<MassUnit, number> = {
  g: 1,
  kg: 1000,
  lb: 453.592,
};

/** Narrowing guard: is this arbitrary unit string one of our mass units? */
export function isMassUnit(u: string): u is MassUnit {
  return u === 'g' || u === 'kg' || u === 'lb';
}

/**
 * Convert a *quantity* from one mass unit to another.
 * e.g. convertQty(0.6, 'kg', 'lb') ≈ 1.3228 (0.6 kg is ~1.32 lb).
 */
export function convertQty(qty: number, from: MassUnit, to: MassUnit): number {
  if (from === to) return qty;
  return (qty * GRAMS_PER[from]) / GRAMS_PER[to];
}

/**
 * Convert a *per-unit price* from one mass unit to another. A price is the
 * dual of a quantity, so it scales inversely: fewer grams per unit → cheaper
 * per unit. price × GRAMS_PER[to] / GRAMS_PER[from].
 * e.g. convertUnitPrice(8.99, 'lb', 'kg') ≈ 19.82 ($8.99/lb is ~$19.82/kg).
 */
export function convertUnitPrice(price: number, from: MassUnit, to: MassUnit): number {
  if (from === to) return price;
  return (price * GRAMS_PER[to]) / GRAMS_PER[from];
}
