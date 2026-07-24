/**
 * Flipp (backflipp.wishabi.com) response types + chain matching for the
 * discover-deals edge function.
 *
 * Dependency-free pure module (no Deno/Node globals) so the parsing/matching
 * logic runs identically in the Deno edge runtime and under Jest. `index.ts`
 * (the only Deno file) does the actual HTTP.
 */

/** The seven grocery chains the app knows about (mirrors the app `Chain`). */
export type Chain =
  | 'metro'
  | 'iga'
  | 'provigo'
  | 'maxi'
  | 'superc'
  | 'loblaws'
  | 'walmart';

/** A flyer object from `/flipp/flyers`. Fields we rely on are optional-typed. */
export interface FlippFlyer {
  id?: number | string;
  merchant?: string;
  merchant_id?: number | string;
  name?: string;
  valid_from?: string | null;
  valid_to?: string | null;
}

/** An item object from `/flipp/items/search`. */
export interface FlippItem {
  id?: number | string;
  /** "Cuisses de poulet | Chicken Thighs" (fr | en). */
  name?: string;
  current_price?: number | string | null;
  original_price?: number | string | null;
  post_price_text?: string | null;
  sale_story?: string | null;
  merchant_name?: string;
  merchant_id?: number | string;
  flyer_id?: number | string;
  valid_from?: string | null;
  valid_to?: string | null;
  /** Flipp taxonomy level-1 category, when present (used to skip non-food). */
  category?: string | null;
}

/**
 * Exact, case-insensitive merchant-name → Chain mapping. We deliberately do NOT
 * fuzzy-match: banners like "Metro Plus" are distinct storefronts and must not
 * be folded into "metro". Observed merchant names: Metro, Super C, Maxi,
 * Provigo, IGA, Walmart (Loblaws included for completeness).
 */
const MERCHANT_TO_CHAIN: Record<string, Chain> = {
  metro: 'metro',
  iga: 'iga',
  provigo: 'provigo',
  maxi: 'maxi',
  'super c': 'superc',
  superc: 'superc',
  loblaws: 'loblaws',
  walmart: 'walmart',
};

/** Map a Flipp merchant name to a known Chain, or null if it is not a target. */
export function chainFromMerchant(merchant: unknown): Chain | null {
  if (typeof merchant !== 'string') return null;
  const key = merchant.trim().toLowerCase();
  return MERCHANT_TO_CHAIN[key] ?? null;
}
