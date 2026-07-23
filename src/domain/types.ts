/**
 * Canonical domain contracts for Flyer to Table.
 * These types are the single source of truth shared across data, services,
 * planner, state, and UI. Keep them free of any runtime/platform dependency.
 */

export type Chain =
  | 'metro'
  | 'iga'
  | 'provigo'
  | 'maxi'
  | 'superc'
  | 'loblaws'
  | 'walmart';

export type DietaryTag =
  | 'vegetarian'
  | 'vegan'
  | 'gluten_free'
  | 'dairy_free'
  | 'nut_free';

export interface Ingredient {
  id: string;
  name: string;
  nameFr?: string;
  category: string;
  isPantryStaple: boolean;
  defaultUnit: string;
}

export interface Store {
  id: string;
  chain: Chain;
  name: string;
  distanceKm: number;
  dealCount: number;
}

export interface Deal {
  id: string;
  storeId: string;
  ingredientId: string;
  label: string;
  labelFr?: string;
  salePrice: number;
  regularPrice: number;
  unit: string;
  /** ISO date (YYYY-MM-DD) */
  validFrom: string;
  /** ISO date (YYYY-MM-DD) */
  validTo: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  /** require()'d asset (number) or remote/uri string. */
  image: number | string;
  cookTimeMinutes: number;
  baseServings: number;
  dietaryTags: DietaryTag[];
  supportsLeftovers: boolean;
  ingredients: RecipeIngredient[];
}

export type MaxCookTime = 15 | 30 | 45 | null;

export type DinnersPerWeek = 5 | 6 | 7;

export interface PlanPreferences {
  postalCode: string;
  selectedStoreIds: string[];
  householdSize: number;
  dietaryRestrictions: DietaryTag[];
  /** null means "60+" — i.e. no cap. */
  maxCookTimeMinutes: MaxCookTime;
  leftoversForLunch: boolean;
  /** Guidance only — never a hard constraint. */
  weeklyBudgetTarget?: number;
  dinnersPerWeek: DinnersPerWeek;
}

export interface PlannedMeal {
  /** 0-based index within the week (0 = first dinner). */
  day: number;
  recipeId: string;
  servings: number;
  estimatedCost: number;
  regularCost: number;
  saleIngredientIds: string[];
}

export interface MealPlanTotals {
  estimated: number;
  regular: number;
  savings: number;
  savingsPct: number;
}

export interface MealPlan {
  id: string;
  /** ISO date (YYYY-MM-DD) of the Monday the plan starts. */
  weekOf: string;
  meals: PlannedMeal[];
  totals: MealPlanTotals;
}

export interface ShoppingListItem {
  ingredientId: string;
  label: string;
  quantity: number;
  unit: string;
  onSale: boolean;
  unitPrice: number;
  lineTotal: number;
  mealIds: string[];
  checked: boolean;
}

export interface ShoppingListStoreGroup {
  store: Store;
  items: ShoppingListItem[];
  subtotal: number;
}

export interface ShoppingList {
  storeGroups: ShoppingListStoreGroup[];
  totals: {
    estimated: number;
    regularTotal: number;
    savings: number;
  };
}

/* ------------------------------------------------------------------ */
/* Discovery                                                          */
/* ------------------------------------------------------------------ */

export type DiscoveryPhase =
  | 'searching_stores'
  | 'fetching_flyers'
  | 'extracting_deals';

export type DiscoveryEvent =
  | {
      type: 'status';
      phase: DiscoveryPhase;
      message: string;
      /** 0..1 */
      progress: number;
    }
  | { type: 'store_found'; store: Store }
  | { type: 'complete'; result: DiscoveryResult }
  | { type: 'failed'; reason: 'no_flyers_found' | 'error'; message: string };

export interface DiscoveryResult {
  postalCode: string;
  stores: Store[];
  deals: Deal[];
  /** ISO timestamp of when this result was produced. */
  fetchedAt: string;
  source: 'cache' | 'live';
}

export interface DiscoverOptions {
  forceRefresh?: boolean;
  onEvent?: (e: DiscoveryEvent) => void;
}

export interface DiscoveryAgent {
  getCached(postalCode: string): Promise<DiscoveryResult | null>;
  discover(postalCode: string, opts?: DiscoverOptions): Promise<DiscoveryResult>;
}

/* ------------------------------------------------------------------ */
/* Recipe source                                                     */
/* ------------------------------------------------------------------ */

export interface RecipeQuery {
  dietaryRestrictions: DietaryTag[];
  maxCookTimeMinutes?: number | null;
  excludeRecipeIds?: string[];
}

export interface RecipeSource {
  list(q: RecipeQuery): Promise<Recipe[]>;
  get(id: string): Promise<Recipe | null>;
}

/* ------------------------------------------------------------------ */
/* Planner                                                           */
/* ------------------------------------------------------------------ */

/** Everything the pure planner functions need. No I/O inside. */
export interface PlanContext {
  deals: Deal[];
  stores: Store[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  prefs: PlanPreferences;
}

export interface SwapAlternative {
  recipe: Recipe;
  estimatedCost: number;
  savings: number;
  rationale: string;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                       */
/* ------------------------------------------------------------------ */

export interface PersistenceAdapter {
  getPreferences(): Promise<PlanPreferences | null>;
  savePreferences(p: PlanPreferences): Promise<void>;
  getDiscoveryCache(postal: string): Promise<DiscoveryResult | null>;
  saveDiscoveryCache(r: DiscoveryResult): Promise<void>;
  getCurrentPlan(): Promise<MealPlan | null>;
  saveCurrentPlan(p: MealPlan): Promise<void>;
  getChecklist(planId: string): Promise<Record<string, boolean>>;
  saveChecklist(planId: string, s: Record<string, boolean>): Promise<void>;
}

export const DIETARY_TAGS: DietaryTag[] = [
  'vegetarian',
  'vegan',
  'gluten_free',
  'dairy_free',
  'nut_free',
];

export const DIETARY_LABELS: Record<DietaryTag, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  gluten_free: 'Gluten-free',
  dairy_free: 'Dairy-free',
  nut_free: 'Nut-free',
};

export const CHAIN_LABELS: Record<Chain, string> = {
  metro: 'Metro',
  iga: 'IGA',
  provigo: 'Provigo',
  maxi: 'Maxi',
  superc: 'Super C',
  loblaws: 'Loblaws',
  walmart: 'Walmart',
};
