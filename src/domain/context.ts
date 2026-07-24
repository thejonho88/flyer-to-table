import type { DiscoveryResult, PlanContext, PlanPreferences } from './types';
import { INGREDIENTS } from '@/data/ingredients';
import { RECIPES } from '@/data/recipes';
import { resolveShoppingMode } from './shoppingMode';

/**
 * Assembles the pure PlanContext the planner/shopping-list functions operate
 * on, from a discovery result (deals + stores) plus the static recipe and
 * ingredient catalogs and the user's preferences.
 *
 * Shopping-mode enforcement lives here — the single choke point every consumer
 * (planner, swap, costing, shopping list) already flows through. In 'single'
 * mode we narrow the effective `selectedStoreIds` to just the chosen store;
 * the PricingResolver then automatically restricts deals to that store AND
 * buckets base-priced items there, so the shopping list collapses to one group
 * with zero changes to PricingResolver/buildShoppingList. An invalid single
 * request (stale/unselected store) falls through as multi — the UI warns.
 */
export function buildPlanContext(
  discovery: Pick<DiscoveryResult, 'deals' | 'stores'>,
  prefs: PlanPreferences,
): PlanContext {
  const resolved = resolveShoppingMode(prefs, discovery.stores);
  const effectivePrefs: PlanPreferences =
    resolved.mode === 'single' && resolved.storeId
      ? { ...prefs, selectedStoreIds: [resolved.storeId] }
      : prefs;

  return {
    deals: discovery.deals,
    stores: discovery.stores,
    recipes: RECIPES,
    ingredients: INGREDIENTS,
    prefs: effectivePrefs,
  };
}
