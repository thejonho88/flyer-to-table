import type {
  Deal,
  Ingredient,
  PlanContext,
  PlanPreferences,
  Recipe,
  Store,
} from './types';
import { convertQty, convertUnitPrice, isMassUnit } from './units';

/** Round to cents to avoid floating-point noise in money math. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Units measured continuously; everything else is a discrete package. 'lb' is
 * continuous so e.g. 2.2 lb of meat does not ceil up to a phantom 3rd pound.
 */
const CONTINUOUS_UNITS = new Set(['kg', 'g', 'lb', 'l', 'ml', 'tbsp', 'tsp', 'cup']);

/** Base-price shape the resolver needs. Widened to carry an optional flyer unit. */
export interface BasePriceLike {
  unitPrice: number;
  unit: string;
  flyerUnit?: string;
}

/**
 * Reconcile a recipe-authored quantity into the pricing/canonical unit so cost
 * is always `quantity × unitPrice` in a single consistent unit.
 *  - same unit → passthrough,
 *  - both mass units → exact conversion,
 *  - anything else (mass vs non-mass, or two different non-mass units) → a loud
 *    dev error and a passthrough, so we never silently multiply mismatched units.
 */
export function reconcileQtyToPricingUnit(
  quantity: number,
  recipeUnit: string,
  pricingUnit: string,
): number {
  if (recipeUnit === pricingUnit) return quantity;
  if (isMassUnit(recipeUnit) && isMassUnit(pricingUnit)) {
    return convertQty(quantity, recipeUnit, pricingUnit);
  }
  // Mismatched, non-convertible units: this is a data bug. Be loud, never guess.
  const msg =
    `[costing] unit mismatch: recipe unit "${recipeUnit}" cannot be reconciled ` +
    `with pricing unit "${pricingUnit}". Prices/quantities may be wrong.`;
  if (typeof console !== 'undefined') console.error(msg);
  if (__DEV__) throw new Error(msg);
  return quantity;
}

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
  /** Canonical unit — matches the recipe/BASE_PRICES unit (e.g. 'kg'). */
  unit: string;
  onSale: boolean;
  /** Effective price per CANONICAL unit (sale price if on sale, else regular). */
  unitPrice: number;
  /** Regular (non-sale) price per CANONICAL unit. */
  regularUnitPrice: number;
  /**
   * Pricing/display unit — the flyer's own unit (e.g. 'lb'). Equals `unit` when
   * the item is priced in its canonical unit. Shopping-list lines render in this
   * unit; per-meal cost math uses the canonical unit above.
   */
  displayUnit: string;
  /** Effective price per DISPLAY unit. */
  displayUnitPrice: number;
  /** Regular price per DISPLAY unit. */
  regularDisplayUnitPrice: number;
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
  private readonly basePrices: Record<string, BasePriceLike>;

  constructor(ctx: PlanContext, basePrices: Record<string, BasePriceLike>) {
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
    // Prices are compared like-for-like: mass-priced deals are normalized to a
    // per-gram basis so a $/lb deal and a $/kg deal are ranked correctly; other
    // units compare raw (deals for one ingredient share a unit in practice).
    this.dealByIngredient = new Map();
    for (const deal of ctx.deals) {
      if (selected.size > 0 && !selected.has(deal.storeId)) continue;
      const existing = this.dealByIngredient.get(deal.ingredientId);
      if (!existing || comparableSalePrice(deal) < comparableSalePrice(existing)) {
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
      // Canonical unit is the recipe/BASE_PRICES unit; the deal is priced in its
      // flyer unit. Convert the flyer-unit prices back to canonical so per-meal
      // cost stays `qty × unitPrice` untouched.
      const base = this.basePrices[ingredientId];
      const canonicalUnit = base?.unit ?? deal.unit;
      const displayUnit = deal.unit;
      const toCanonical = massConverter(displayUnit, canonicalUnit);
      return {
        ingredientId,
        label: deal.label,
        unit: canonicalUnit,
        onSale: true,
        unitPrice: toCanonical(deal.salePrice),
        regularUnitPrice: toCanonical(deal.regularPrice),
        displayUnit,
        displayUnitPrice: deal.salePrice,
        regularDisplayUnitPrice: deal.regularPrice,
        storeId: deal.storeId,
      };
    }

    const base = this.basePrices[ingredientId];
    if (!base) return null; // unknown price: treat as excluded rather than guess
    // Base prices are stored in the canonical unit; if the item is advertised in
    // a different (mass) flyer unit, surface a display price in that unit too so
    // an off-sale meat still shows "$X.XX/lb" consistently with its deals.
    const displayUnit = base.flyerUnit ?? base.unit;
    const toDisplay = massConverter(base.unit, displayUnit);
    return {
      ingredientId,
      label: ingredient.name,
      unit: base.unit,
      onSale: false,
      unitPrice: base.unitPrice,
      regularUnitPrice: base.unitPrice,
      displayUnit,
      displayUnitPrice: toDisplay(base.unitPrice),
      regularDisplayUnitPrice: toDisplay(base.unitPrice),
      storeId: this.nearestStoreId ?? '',
    };
  }
}

/**
 * A price-conversion function from `from` unit to `to` unit. Identity when the
 * units match; exact mass conversion when both are mass units; identity (the
 * safest non-guess) otherwise — callers only pair convertible units in practice.
 */
function massConverter(from: string, to: string): (price: number) => number {
  if (from === to) return (p) => p;
  if (isMassUnit(from) && isMassUnit(to)) {
    return (p) => convertUnitPrice(p, from, to);
  }
  return (p) => p;
}

/** Per-gram sale price for mass deals; raw sale price otherwise. */
function comparableSalePrice(deal: Deal): number {
  return isMassUnit(deal.unit)
    ? convertUnitPrice(deal.salePrice, deal.unit, 'g')
    : deal.salePrice;
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
    // Reconcile the recipe quantity into the canonical pricing unit before
    // multiplying, so a mass mismatch converts and a real mismatch is loud.
    const qty = reconcileQtyToPricingUnit(ri.quantity * scale, ri.unit, p.unit);
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
