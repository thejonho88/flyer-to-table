import type { PlanPreferences, Store } from './types';

export type ShoppingMode = 'multi' | 'single';

/** Why a requested single-store mode could not be honoured. */
export type ShoppingModeInvalidReason = 'store_missing';

export interface ResolvedShoppingMode {
  /** The mode actually in effect (may differ from the request if invalid). */
  mode: ShoppingMode;
  /** The store to shop at, when `mode === 'single'`. */
  storeId?: string;
  /**
   * Set when the user ASKED for single mode but it could not be honoured (the
   * chosen store is missing from the selection or from the discovery result).
   * The effective `mode` falls back to 'multi'; callers MUST surface this
   * loudly — the discovery flow's "never fail silently" rule extends here.
   */
  invalid?: ShoppingModeInvalidReason;
}

/**
 * Single source of truth for interpreting the shopping-mode preference against
 * the available stores. Used by buildPlanContext (to narrow pricing to one
 * store) AND by the Shopping List UI (to render the control and its warnings)
 * so the two can never disagree.
 *
 * Rules:
 *  - anything other than an explicit 'single' request → multi (the default),
 *  - 'single' with a `singleStoreId` that is BOTH in `selectedStoreIds` and
 *    present in `stores` → single, targeting that store,
 *  - 'single' with a missing/stale `singleStoreId` → multi + invalid, so the
 *    screen can warn instead of silently pricing the wrong basket.
 *
 * Pure; no I/O.
 */
export function resolveShoppingMode(
  prefs: Pick<PlanPreferences, 'shoppingMode' | 'singleStoreId' | 'selectedStoreIds'>,
  stores: Store[],
): ResolvedShoppingMode {
  if (prefs.shoppingMode !== 'single') {
    return { mode: 'multi' };
  }

  const storeId = prefs.singleStoreId;
  const inSelection = !!storeId && prefs.selectedStoreIds.includes(storeId);
  const inResult = !!storeId && stores.some((s) => s.id === storeId);

  if (!storeId || !inSelection || !inResult) {
    return { mode: 'multi', invalid: 'store_missing' };
  }

  return { mode: 'single', storeId };
}
