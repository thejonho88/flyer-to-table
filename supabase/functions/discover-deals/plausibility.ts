/**
 * Server-side price-plausibility bands for the edge functions.
 *
 * Dependency-free plain TypeScript (no Deno or Node globals) so the same file
 * runs identically in the Deno edge runtime AND under Jest. This is a hand-off
 * copy of the client module in `src/domain/priceBand.ts`: the band constants,
 * the mass-conversion factors (GRAMS_PER), and the classify logic are all
 * duplicated here rather than imported, because MCP deploys are per-function
 * bundles that cannot reach into `src/`.
 *
 * The two edge copies (extract-flyer/ and discover-deals/) are byte-identical,
 * and this file's constants + price table are kept in lockstep with the client
 * module and `src/data/pricing.ts` by `__tests__/plausibilitySync.test.ts`. If
 * you edit BASE_PRICES in src/data/pricing.ts, or any band constant in
 * src/domain/priceBand.ts, update BOTH edge copies to match.
 *
 * ratio = toCanonical(salePrice, dealUnit → base.unit) / base.price
 *   PLAUSIBLE [0.30, 1.50] → 'ok'
 *   HARD      [0.15, 3.00] → outside is 'reject'; the gap is 'suspicious'
 * Boundaries inclusive on both sides. Abstains ('ok') when there is no base
 * price, a non-positive base price, or a non-convertible deal unit.
 */

export type PriceBand = 'ok' | 'suspicious' | 'reject';

/** Inner (plausible) band: ratios in [PLAUSIBLE_MIN, PLAUSIBLE_MAX] are 'ok'. */
export const PLAUSIBLE_MIN = 0.3;
export const PLAUSIBLE_MAX = 1.5;
/** Outer (hard) band: ratios outside [HARD_MIN, HARD_MAX] are 'reject'. */
export const HARD_MIN = 0.15;
export const HARD_MAX = 3.0;

/** Grams per one of each mass unit. 1 lb = 453.592 g (avoirdupois). */
export const GRAMS_PER: Record<string, number> = {
  g: 1,
  kg: 1000,
  lb: 453.592,
};

/** Base regular price per canonical unit — subset of src/data/pricing.ts. */
export interface BandBasePrice {
  price: number;
  unit: string;
}

/**
 * Base regular prices, mirrored from src/data/pricing.ts BASE_PRICES ({ price,
 * unit } only — flyerUnit is irrelevant to the ratio). Enforced identical to the
 * app table by plausibilitySync.test.ts.
 */
export const BASE_PRICES: Record<string, BandBasePrice> = {
  onion: { price: 0.6, unit: "unit" },
  garlic: { price: 0.15, unit: "clove" },
  carrot: { price: 0.3, unit: "unit" },
  bell_pepper: { price: 1.2, unit: "unit" },
  broccoli: { price: 2.49, unit: "bunch" },
  spinach: { price: 3.49, unit: "container" },
  tomato: { price: 0.8, unit: "unit" },
  sweet_potato: { price: 2.99, unit: "kg" },
  potato: { price: 1.99, unit: "kg" },
  mushroom: { price: 2.99, unit: "pack" },
  zucchini: { price: 1.0, unit: "unit" },
  lemon: { price: 0.79, unit: "unit" },
  lime: { price: 0.69, unit: "unit" },
  cilantro: { price: 1.29, unit: "bunch" },
  green_onion: { price: 1.29, unit: "bunch" },
  ginger: { price: 0.99, unit: "unit" },
  avocado: { price: 1.49, unit: "unit" },
  cabbage: { price: 2.49, unit: "unit" },
  kale: { price: 2.79, unit: "bunch" },
  corn: { price: 0.99, unit: "unit" },
  chicken_thigh: { price: 9.9, unit: "kg" },
  chicken_breast: { price: 24.23, unit: "kg" },
  ground_beef: { price: 14.31, unit: "kg" },
  beef_strips: { price: 26.43, unit: "kg" },
  pork_shoulder: { price: 8.8, unit: "kg" },
  ground_pork: { price: 9.9, unit: "kg" },
  salmon: { price: 0.033, unit: "g" },
  tilapia: { price: 0.022, unit: "g" },
  shrimp: { price: 0.03, unit: "g" },
  eggs: { price: 4.99, unit: "dozen" },
  butter: { price: 5.49, unit: "block" },
  milk: { price: 2.99, unit: "L" },
  cheddar: { price: 6.49, unit: "block" },
  parmesan: { price: 6.99, unit: "wedge" },
  greek_yogurt: { price: 4.29, unit: "tub" },
  cream: { price: 3.29, unit: "carton" },
  feta: { price: 4.49, unit: "pack" },
  rice: { price: 5.49, unit: "bag" },
  pasta: { price: 2.49, unit: "box" },
  penne_ww: { price: 2.79, unit: "box" },
  rice_gf: { price: 5.99, unit: "bag" },
  quinoa: { price: 6.99, unit: "bag" },
  tortilla: { price: 3.49, unit: "pack" },
  burger_buns: { price: 3.29, unit: "pack" },
  arborio_rice: { price: 5.99, unit: "bag" },
  couscous: { price: 3.49, unit: "box" },
  black_beans: { price: 1.49, unit: "can" },
  chickpeas: { price: 1.49, unit: "can" },
  lentils: { price: 3.29, unit: "bag" },
  canned_tomatoes: { price: 1.79, unit: "can" },
  tomato_sauce: { price: 2.99, unit: "jar" },
  coconut_milk: { price: 2.29, unit: "can" },
  kidney_beans: { price: 1.49, unit: "can" },
  tofu: { price: 3.49, unit: "pack" },
  peanut_butter: { price: 4.99, unit: "jar" },
  bbq_sauce: { price: 3.99, unit: "bottle" },
};

function isMassUnit(u: string): boolean {
  return u === "g" || u === "kg" || u === "lb";
}

/**
 * Convert `salePrice` (in `dealUnit`) into `canonicalUnit`, or null when the two
 * units are not convertible. Exact match is a passthrough; mass↔mass converts
 * exactly (price scales inversely to grams-per-unit); everything else → null.
 */
function toCanonicalPrice(
  salePrice: number,
  dealUnit: string,
  canonicalUnit: string,
): number | null {
  if (dealUnit === canonicalUnit) return salePrice;
  if (isMassUnit(dealUnit) && isMassUnit(canonicalUnit)) {
    return (salePrice * GRAMS_PER[canonicalUnit]) / GRAMS_PER[dealUnit];
  }
  return null;
}

/** Map a raw price ratio to a band (inclusive on every boundary). */
export function bandForRatio(ratio: number): PriceBand {
  if (ratio < HARD_MIN || ratio > HARD_MAX) return "reject";
  if (ratio >= PLAUSIBLE_MIN && ratio <= PLAUSIBLE_MAX) return "ok";
  return "suspicious";
}

/**
 * Classify a sale price against the ingredient's base regular price. Abstains
 * ('ok') when there is no base price, a non-positive base price, or a deal unit
 * that cannot be converted into the canonical unit.
 */
export function classifyPrice(
  salePrice: number,
  dealUnit: string,
  ingredientId: string,
): PriceBand {
  const base = BASE_PRICES[ingredientId];
  if (!base || base.price <= 0) return "ok"; // abstain: no reference price
  const canonical = toCanonicalPrice(salePrice, dealUnit, base.unit);
  if (canonical === null) return "ok"; // abstain: unit not convertible
  return bandForRatio(canonical / base.price);
}
