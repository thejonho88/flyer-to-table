/**
 * Pure merge logic for bring-your-own-flyer overlays. No React, no zustand, no
 * I/O — the discovery store feeds a DiscoveryResult in and gets a new one back.
 * Every function returns a NEW result (never mutates its input) and keeps each
 * Store.dealCount in sync with the deals array (the UI shows dealCount).
 *
 * Merge policy: an uploaded flyer for store S REPLACES all of S's existing
 * deals. Edits set provenance 'edited' and clamp salePrice ≤ regularPrice so
 * savings can never go negative.
 */
import type { Deal, DiscoveryResult, FlyerOverlay, Store } from './types';

/** Recompute every Store.dealCount from the deals array (deals are the truth). */
function withRecountedStores(stores: Store[], deals: Deal[]): Store[] {
  const counts = new Map<string, number>();
  for (const d of deals) counts.set(d.storeId, (counts.get(d.storeId) ?? 0) + 1);
  return stores.map((s) => {
    const next = counts.get(s.id) ?? 0;
    return s.dealCount === next ? s : { ...s, dealCount: next };
  });
}

/** Clamp a sale price into [0, regularPrice] — never a negative saving. */
function clampSalePrice(salePrice: number, regularPrice: number): number {
  if (!Number.isFinite(salePrice) || salePrice < 0) return 0;
  return Math.min(salePrice, regularPrice);
}

/**
 * Replace ALL of `storeId`'s deals with `deals` (typically freshly extracted).
 * Seeded deals for that store are dropped; the store's dealCount is recomputed.
 */
export function applyExtractedDeals(
  result: DiscoveryResult,
  storeId: string,
  deals: Deal[],
): DiscoveryResult {
  const kept = result.deals.filter((d) => d.storeId !== storeId);
  const nextDeals = [...kept, ...deals];
  return {
    ...result,
    deals: nextDeals,
    stores: withRecountedStores(result.stores, nextDeals),
  };
}

/** Fields a user may edit on a confirmed deal. */
export type DealPatch = Partial<Pick<Deal, 'label' | 'salePrice' | 'regularPrice'>>;

/**
 * Apply `patch` to the deal with `dealId`. Marks it provenance 'edited' and
 * clamps salePrice ≤ regularPrice. Editing `label` leaves `labelFr` untouched.
 * No-op (returns the same result) if the deal id is unknown.
 */
export function updateDealInResult(
  result: DiscoveryResult,
  dealId: string,
  patch: DealPatch,
): DiscoveryResult {
  let found = false;
  const nextDeals = result.deals.map((d) => {
    if (d.id !== dealId) return d;
    found = true;
    const merged: Deal = { ...d, ...patch, provenance: 'edited' };
    merged.salePrice = clampSalePrice(merged.salePrice, merged.regularPrice);
    return merged;
  });
  if (!found) return result;
  // dealCount is unchanged by an edit, but recompute defensively.
  return {
    ...result,
    deals: nextDeals,
    stores: withRecountedStores(result.stores, nextDeals),
  };
}

/** Remove the deal with `dealId` and recompute its store's dealCount. */
export function removeDealFromResult(
  result: DiscoveryResult,
  dealId: string,
): DiscoveryResult {
  const nextDeals = result.deals.filter((d) => d.id !== dealId);
  if (nextDeals.length === result.deals.length) return result;
  return {
    ...result,
    deals: nextDeals,
    stores: withRecountedStores(result.stores, nextDeals),
  };
}

/**
 * Re-apply an entire overlay on top of a result. Used after a forced
 * re-discovery / cache expiry so user uploads are NEVER silently dropped.
 * Entries for stores not present in `result` are skipped (no orphan deals);
 * the overlay is meant to sit on top of already-present (seeded + added) stores.
 */
export function applyOverlay(
  result: DiscoveryResult,
  overlay: FlyerOverlay,
): DiscoveryResult {
  const present = new Set(result.stores.map((s) => s.id));
  let next = result;
  for (const [storeId, entry] of Object.entries(overlay.entries)) {
    if (!present.has(storeId)) continue;
    next = applyExtractedDeals(next, storeId, entry.deals);
  }
  return next;
}
