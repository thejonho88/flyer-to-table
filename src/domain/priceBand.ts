/**
 * Price-plausibility bands. Pure, platform-free. This is the client-side single
 * source of truth for deciding whether a deal's sale price is believable given
 * the ingredient's known regular (base) price -- the last line of defence against
 * a rogue/stale flyer price silently poisoning the plan (e.g. a per-gram shrimp
 * price of $4.77 -> $4,770/kg). The two edge functions carry a dependency-free
 * copy (plausibility.ts in each edge function) kept in lockstep by
 * __tests__/plausibilitySync.test.ts.
 *
 * The ratio is the deal's sale price, converted into the ingredient's canonical
 * BASE_PRICES unit, divided by the ingredient's base regular price:
 *   ratio = toCanonical(salePrice, dealUnit -> base.unit) / base.unitPrice
 *
 * Two nested bands, both derived from the seeded Montreal flyer data -- every
 * real seed sits at a 15-40% discount (ratio 0.60-0.85), and realistic loss-
 * leaders / premium regulars stay comfortably inside [0.30, 1.50]:
 *
 *   PLAUSIBLE [0.30, 1.50]  -> 'ok'         (a believable flyer price)
 *   HARD      [0.15, 3.00]  -> outside is 'reject' (absurd -- almost certainly a
 *                              unit/parse error, e.g. 100x off); the gap between
 *                              PLAUSIBLE and HARD is 'suspicious' (unusual but
 *                              not impossible -- surfaced to the user, not trusted
 *                              blindly, never hard-dropped on the client).
 *
 * Boundaries are inclusive on BOTH sides of each band, so exactly 0.30/1.50 are
 * 'ok' and exactly 0.15/3.00 are 'suspicious'.
 *
 * The classifier ABSTAINS (returns 'ok', band not applicable) when it has no
 * trustworthy reference: no base price for the ingredient, a non-positive base
 * price, or a deal unit that cannot be converted into the canonical unit
 * (mass<->mass only; exact-match units need no conversion -- anything else is left
 * to the unit gate that owns it upstream).
 */
import { convertUnitPrice, isMassUnit } from './units';

export type PriceBand = 'ok' | 'suspicious' | 'reject';

/** Inner (plausible) band: ratios in [PLAUSIBLE_MIN, PLAUSIBLE_MAX] are 'ok'. */
export const PLAUSIBLE_MIN = 0.3;
export const PLAUSIBLE_MAX = 1.5;
/** Outer (hard) band: ratios outside [HARD_MIN, HARD_MAX] are 'reject'. */
export const HARD_MIN = 0.15;
export const HARD_MAX = 3.0;

/**
 * The base-price shape the classifier needs: a regular price in a canonical
 * unit. Structurally satisfied by BasePriceLike (costing.ts) and BasePrice
 * (src/data/pricing.ts), so callers pass whatever they already looked up in
 * their base-price map -- no adapter needed.
 */
export interface PriceBandBase {
  /** Regular price per `unit`. */
  unitPrice: number;
  /** Canonical unit the base price is expressed in. */
  unit: string;
}

/**
 * Convert `salePrice` (in `dealUnit`) into `canonicalUnit`, or null when the two
 * units are not convertible (the classifier then abstains). Exact unit match is
 * a passthrough; mass<->mass converts exactly via units.ts; everything else -> null.
 */
function toCanonicalPrice(
  salePrice: number,
  dealUnit: string,
  canonicalUnit: string,
): number | null {
  if (dealUnit === canonicalUnit) return salePrice;
  if (isMassUnit(dealUnit) && isMassUnit(canonicalUnit)) {
    return convertUnitPrice(salePrice, dealUnit, canonicalUnit);
  }
  return null;
}

/** Map a raw price ratio to a band (inclusive on every boundary). */
export function bandForRatio(ratio: number): PriceBand {
  if (ratio < HARD_MIN || ratio > HARD_MAX) return 'reject';
  if (ratio >= PLAUSIBLE_MIN && ratio <= PLAUSIBLE_MAX) return 'ok';
  return 'suspicious';
}

/**
 * Classify a deal's sale price against the ingredient's base regular price.
 * Abstains ('ok') when there is no trustworthy reference (see module doc).
 */
export function classifyPrice(
  salePrice: number,
  dealUnit: string,
  base: PriceBandBase | undefined,
): PriceBand {
  if (!base || base.unitPrice <= 0) return 'ok'; // abstain: no reference price
  const canonical = toCanonicalPrice(salePrice, dealUnit, base.unit);
  if (canonical === null) return 'ok'; // abstain: unit not convertible
  return bandForRatio(canonical / base.unitPrice);
}
