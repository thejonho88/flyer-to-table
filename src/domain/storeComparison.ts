import type { MealPlan, PlanContext, Store } from './types';
import { buildShoppingList } from './shoppingList';

export interface StoreTotal {
  store: Store;
  /** buildShoppingList(...).totals.estimated for a one-stop trip to this store. */
  total: number;
}

export interface OneStopComparison {
  /**
   * The current (multi-store) list total — each item routed to its cheapest
   * selected store. Equals `buildShoppingList(plan, ctx).totals.estimated` for
   * the multi-store `ctx` passed in.
   */
  multiTotal: number;
  /**
   * Per candidate store, the total to buy the SAME plan entirely at that store
   * (deals restricted to it; everything else at base price). Sorted cheapest
   * first. This is a re-pricing of the current plan, NOT a re-optimized plan.
   */
  perStore: StoreTotal[];
}

/**
 * Compares one-stop totals across the candidate stores for the CURRENT plan.
 *
 * `ctx` must be the MULTI-store context (all selected stores) — its
 * `prefs.selectedStoreIds` defines the candidate universe. For each candidate we
 * rebuild the context restricted to that one store and re-run buildShoppingList,
 * so per-store totals correctly include base-priced items (a store with no
 * relevant deals still prices the whole basket at base prices). Pure over ctx.
 */
export function compareOneStopTotals(
  plan: MealPlan,
  ctx: PlanContext,
): OneStopComparison {
  const multiTotal = buildShoppingList(plan, ctx).totals.estimated;

  // Candidate universe mirrors PricingResolver's selection semantics: an empty
  // selection means "all stores".
  const selected = ctx.prefs.selectedStoreIds;
  const candidates =
    selected.length === 0
      ? ctx.stores
      : ctx.stores.filter((s) => selected.includes(s.id));

  const perStore: StoreTotal[] = candidates.map((store) => {
    const singleCtx: PlanContext = {
      ...ctx,
      prefs: { ...ctx.prefs, selectedStoreIds: [store.id] },
    };
    return {
      store,
      total: buildShoppingList(plan, singleCtx).totals.estimated,
    };
  });

  perStore.sort((a, b) => a.total - b.total || a.store.distanceKm - b.store.distanceKm);

  return { multiTotal, perStore };
}
