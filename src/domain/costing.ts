import type {
  Deal,
  Ingredient,
  PlanContext,
  PlanPreferences,
  Recipe,
  Store,
} from './types';

/** Round to cents to avoid floating-point noise in money math. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Units measured continuously; everything else is a discrete package. */
const CONTINUOUS_UNITS = new Set(['kg', 'g', 'l', 'ml', 'tbsp', 'tsp', 'cup']);

/**
 * Purchasable quantity: discrete packages (cans, bags, packs, units…) round
 * UP because you can't buy a fraction of one. Continuous units keep 2 decimals.
 */
export function purchasableQuantity(quantity: number, unit: string): number {
  if (CONTINUOUS_UNITS.has(unit.toLowerCase())) return round2(quantity);
  return Math.ceil(quantity - 1e-9);
}

export interface IngredientPricing {
  ingredientId: string;
  label: string;
  unit: string;
  onSale: boolean;
  /** Effective price per unit (sale price if on sale, else regular). */
  unitPrice: number;
  /** Regular (non-sale) price per unit. */
  regularUnitPrice: number;
  /** Store the item is sourced from (deal store, or nearest selected store). */
  storeId: string;
}

/**
 * Resolves the best price for each ingredient given the deals available at the
 * user's selected stores, plus a base regular-price fallback for items not on
 * sale anywhere. Pure over the PlanContext.
 */
export class PricingResolver {
  private readonly dealByIngredient: Map<string, Deal>;
  private readonly ingredientById: Map<string, Ingredient>;
  private readonly nearestStoreId: string | undefined;
  private readonly basePrices: Record<string, { unitPrice: number; unit: string }>;

  constructor(
    ctx: PlanContext,
    basePrices: Record<string, { unitPrice: number; unit: string }>,
  ) {
    this.ingredientById = new Map(ctx.ingredients.map((i) => [i.id, i]));
    this.basePrices = basePrices;

    const selected = new Set(ctx.prefs.selectedStoreIds);
    const selectedStores = ctx.stores.filter(
      (s) => selected.size === 0 || selected.has(s.id),
    );
    this.nearestStoreId = [...selectedStores].sort(
      (a, b) => a.distanceKm - b.distanceKm,
    )[0]?.id;

    // Keep only the lowest sale price per ingredient across selected stores.
    this.dealByIngredient = new Map();
    for (const deal of ctx.deals) {
      if (selected.size > 0 && !selected.has(deal.storeId)) continue;
      const existing = this.dealByIngredient.get(deal.ingredientId);
      if (!existing || deal.salePrice < existing.salePrice) {
        this.dealByIngredient.set(deal.ingredientId, deal);
      }
    }
  }

  resolve(ingredientId: string): IngredientPricing | null {
    const ingredient = this.ingredientById.get(ingredientId);
    // Pantry staples are excluded from cost/list entirely.
    if (!ingredient || ingredient.isPantryStaple) return null;

    const deal = this.dealByIngredient.get(ingredientId);
    if (deal) {
      return {
        ingredientId,
        label: deal.label,
        unit: deal.unit,
        onSale: true,
        unitPrice: deal.salePrice,
        regularUnitPrice: deal.regularPrice,
        storeId: deal.storeId,
      };
    }

    const base = this.basePrices[ingredientId];
    if (!base) return null; // unknown price: treat as excluded rather than guess
    return {
      ingredientId,
      label: ingredient.name,
      unit: base.unit,
      onSale: false,
      unitPrice: base.unitPrice,
      regularUnitPrice: base.unitPrice,
      storeId: this.nearestStoreId ?? '',
    };
  }
}

/**
 * Portions to cook for a recipe. Leftovers-for-lunch doubles portions for
 * recipes that support it (cook once, eat again next day), so the shopping
 * list and cost reflect the extra servings.
 */
export function servingsFor(prefs: PlanPreferences, recipe: Recipe): number {
  const base = Math.max(1, prefs.householdSize);
  if (prefs.leftoversForLunch && recipe.supportsLeftovers) return base * 2;
  return base;
}

export interface MealCost {
  estimatedCost: number;
  regularCost: number;
  saleIngredientIds: string[];
}

/**
 * Per-meal cost, net of pantry staples, using scaled quantities. Raw (un-
 * rounded per-package) quantities — the plan's per-meal cost is a smooth
 * number; the shopping list applies package rounding at the consolidated level.
 */
export function computeMealCost(
  recipe: Recipe,
  servings: number,
  pricing: PricingResolver,
): MealCost {
  const scale = servings / recipe.baseServings;
  let estimated = 0;
  let regular = 0;
  const saleIngredientIds: string[] = [];

  for (const ri of recipe.ingredients) {
    const p = pricing.resolve(ri.ingredientId);
    if (!p) continue; // staple or unpriced -> excluded
    const qty = ri.quantity * scale;
    estimated += qty * p.unitPrice;
    regular += qty * p.regularUnitPrice;
    if (p.onSale) saleIngredientIds.push(ri.ingredientId);
  }

  return {
    estimatedCost: round2(estimated),
    regularCost: round2(regular),
    saleIngredientIds,
  };
}

/** Coarse protein grouping used by the variety heuristic. */
export function proteinGroup(recipe: Recipe): string {
  const ids = recipe.ingredients.map((i) => i.ingredientId);
  const has = (id: string) => ids.includes(id);
  if (has('chicken_thigh') || has('chicken_breast')) return 'chicken';
  if (has('ground_beef') || has('beef_strips')) return 'beef';
  if (has('pork_shoulder') || has('ground_pork')) return 'pork';
  if (has('salmon') || has('tilapia') || has('shrimp')) return 'seafood';
  if (has('tofu')) return 'tofu';
  if (
    has('lentils') ||
    has('chickpeas') ||
    has('black_beans') ||
    has('kidney_beans')
  )
    return 'legume';
  return 'veggie';
}

export function nearestSelectedStore(
  stores: Store[],
  selectedStoreIds: string[],
): Store | undefined {
  const selected = new Set(selectedStoreIds);
  const pool = stores.filter((s) => selected.size === 0 || selected.has(s.id));
  return [...pool].sort((a, b) => a.distanceKm - b.distanceKm)[0];
}
