import type {
  MealPlan,
  PlanContext,
  ShoppingList,
  ShoppingListItem,
  ShoppingListStoreGroup,
  Store,
} from './types';
import { BASE_PRICES } from '@/data/pricing';
import {
  PricingResolver,
  purchasableQuantity,
  reconcileQtyToPricingUnit,
  round2,
} from './costing';
import { convertQty, isMassUnit } from './units';

interface Accum {
  rawQty: number;
  mealIds: Set<string>;
}

/**
 * Builds a consolidated shopping list from a plan:
 *  - pantry staples are ALWAYS excluded (non-negotiable rule),
 *  - ingredients used across multiple meals are de-duplicated and their
 *    quantities merged (same canonical unit),
 *  - consolidated quantities round up to whole packages where applicable,
 *  - items are grouped by store with per-store subtotals and sale flags.
 * Pure over the PlanContext.
 */
export function buildShoppingList(plan: MealPlan, ctx: PlanContext): ShoppingList {
  const pricing = new PricingResolver(ctx, BASE_PRICES);
  const recipeById = new Map(ctx.recipes.map((r) => [r.id, r]));
  const storeById = new Map(ctx.stores.map((s) => [s.id, s]));

  // 1) Accumulate raw quantities per ingredient across all meals.
  const acc = new Map<string, Accum>();
  for (const meal of plan.meals) {
    const recipe = recipeById.get(meal.recipeId);
    if (!recipe) continue;
    const scale = meal.servings / recipe.baseServings;
    for (const ri of recipe.ingredients) {
      const priced = pricing.resolve(ri.ingredientId); // null => staple/unpriced
      if (!priced) continue;
      const entry = acc.get(ri.ingredientId) ?? { rawQty: 0, mealIds: new Set() };
      // Accumulate in the canonical pricing unit so quantities across meals with
      // different authored units still add up correctly.
      entry.rawQty += reconcileQtyToPricingUnit(
        ri.quantity * scale,
        ri.unit,
        priced.unit,
      );
      entry.mealIds.add(meal.recipeId);
      acc.set(ri.ingredientId, entry);
    }
  }

  // 2) Turn each accumulated ingredient into a priced, store-bucketed line.
  const buckets = new Map<string, ShoppingListItem[]>();
  const regularByStore = new Map<string, number>();
  let estimated = 0;
  let regularTotal = 0;

  for (const [ingredientId, entry] of acc) {
    const p = pricing.resolve(ingredientId);
    if (!p) continue;
    const storeId = p.storeId || ctx.stores[0]?.id || '';
    // Package rounding happens in the canonical unit (discrete → ceil,
    // continuous → 2dp), then the line is expressed in the flyer/display unit.
    const canonicalQty = purchasableQuantity(entry.rawQty, p.unit);
    const displayQty =
      p.displayUnit !== p.unit && isMassUnit(p.displayUnit) && isMassUnit(p.unit)
        ? round2(convertQty(canonicalQty, p.unit, p.displayUnit))
        : canonicalQty;
    const lineTotal = round2(displayQty * p.displayUnitPrice);
    const regularLine = round2(displayQty * p.regularDisplayUnitPrice);

    const item: ShoppingListItem = {
      ingredientId,
      label: p.label,
      quantity: displayQty,
      unit: p.displayUnit,
      onSale: p.onSale,
      unitPrice: p.displayUnitPrice,
      lineTotal,
      mealIds: [...entry.mealIds],
      checked: false,
    };

    const list = buckets.get(storeId) ?? [];
    list.push(item);
    buckets.set(storeId, list);

    estimated += lineTotal;
    regularTotal += regularLine;
    regularByStore.set(storeId, (regularByStore.get(storeId) ?? 0) + regularLine);
  }

  // 3) Build store groups (only stores that have items), sorted by distance.
  const storeGroups: ShoppingListStoreGroup[] = [];
  for (const [storeId, items] of buckets) {
    const store = storeById.get(storeId);
    if (!store) continue;
    items.sort((a, b) => {
      if (a.onSale !== b.onSale) return a.onSale ? -1 : 1; // sale items first
      return a.label.localeCompare(b.label);
    });
    const subtotal = round2(items.reduce((s, it) => s + it.lineTotal, 0));
    storeGroups.push({ store, items, subtotal });
  }
  storeGroups.sort((a, b) => a.store.distanceKm - b.store.distanceKm);

  return {
    storeGroups,
    totals: {
      estimated: round2(estimated),
      regularTotal: round2(regularTotal),
      savings: round2(regularTotal - estimated),
    },
  };
}

export function shoppingListStats(list: ShoppingList): {
  totalItems: number;
  onSaleItems: number;
  storeCount: number;
} {
  let totalItems = 0;
  let onSaleItems = 0;
  for (const g of list.storeGroups) {
    totalItems += g.items.length;
    onSaleItems += g.items.filter((i) => i.onSale).length;
  }
  return { totalItems, onSaleItems, storeCount: list.storeGroups.length };
}

export function itemKey(storeId: string, ingredientId: string): string {
  return `${storeId}:${ingredientId}`;
}

/** Convenience for narrow store references without importing the whole type. */
export type StoreRef = Store;
