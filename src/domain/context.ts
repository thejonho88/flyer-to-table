import type { DiscoveryResult, PlanContext, PlanPreferences } from './types';
import { INGREDIENTS } from '@/data/ingredients';
import { RECIPES } from '@/data/recipes';

/**
 * Assembles the pure PlanContext the planner/shopping-list functions operate
 * on, from a discovery result (deals + stores) plus the static recipe and
 * ingredient catalogs and the user's preferences.
 */
export function buildPlanContext(
  discovery: Pick<DiscoveryResult, 'deals' | 'stores'>,
  prefs: PlanPreferences,
): PlanContext {
  return {
    deals: discovery.deals,
    stores: discovery.stores,
    recipes: RECIPES,
    ingredients: INGREDIENTS,
    prefs,
  };
}
