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
  /**
   * Landing page for this store's weekly flyer. Mock data uses the chain-level
   * flyer URL (see CHAIN_FLYER_URLS); a real discovery agent could resolve a
   * store-specific circulaire page.
   */
  flyerUrl?: string;
}

export interface Deal {
  id: string;
  storeId: string;
  ingredientId: string;
  label: string;
  labelFr?: string;
  /** Sale price expressed in `unit`. */
  salePrice: number;
  /** Regular (pre-sale) price expressed in `unit`. */
  regularPrice: number;
  /**
   * Pricing unit for salePrice/regularPrice — the flyer's own unit (e.g. 'lb'
   * for meat, 'g' for fish, or a package unit). May differ from the recipe's
   * canonical unit; the PricingResolver converts as needed.
   */
  unit: string;
  /**
   * Exact flyer page the deal was parsed from. In mock data this is the chain's
   * flyer landing page; a real agent would capture the specific circulaire page.
   */
  sourceUrl?: string;
  /** ISO date (YYYY-MM-DD) */
  validFrom: string;
  /** ISO date (YYYY-MM-DD) */
  validTo: string;
  /**
   * Where this deal came from. Optional/additive so existing (seeded) caches
   * remain valid without a version bump:
   *  - 'seeded'    — from the built-in demo data (default when absent),
   *  - 'extracted' — parsed from a user-uploaded flyer,
   *  - 'edited'    — extracted then hand-corrected by the user.
   */
  provenance?: 'seeded' | 'extracted' | 'edited';
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

/**
 * A consolidated shopping-list line. quantity/unit/unitPrice are all in the
 * item's pricing/display unit (the flyer's unit — e.g. "2.5 lb × $8.99/lb"),
 * NOT necessarily the recipe's canonical unit. Invariant:
 *   lineTotal === round2(quantity × unitPrice)
 */
export interface ShoppingListItem {
  ingredientId: string;
  label: string;
  /** Quantity to buy, in `unit` (the pricing/display unit). */
  quantity: number;
  /** Pricing/display unit (e.g. 'lb', 'g', 'can'). */
  unit: string;
  onSale: boolean;
  /** Effective price per `unit`. */
  unitPrice: number;
  /** round2(quantity × unitPrice). */
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
/* Bring-your-own-flyer extraction                                    */
/* ------------------------------------------------------------------ */

/**
 * A user-picked flyer file. `uri` is a transient handle (object URL on web) —
 * NEVER persisted. Only `name`/metadata + the resulting Deal[] are stored.
 */
export interface UploadedFlyerFile {
  name: string;
  mimeType: string;
  size: number;
  uri: string;
}

export type FlyerExtractionEvent = {
  type: 'status';
  message: string;
  /** 0..1 */
  progress: number;
};

export interface FlyerExtractInput {
  file: UploadedFlyerFile;
  storeId: string;
  chain: Chain;
}

export interface FlyerExtractOptions {
  onEvent?: (e: FlyerExtractionEvent) => void;
}

/**
 * Seam over the real (future) Claude/Supabase flyer parser. The mock never
 * reads `file.uri`; a live implementation would. Fails LOUDLY — never resolves
 * an empty Deal[] silently.
 */
export interface FlyerExtractor {
  extract(
    input: FlyerExtractInput,
    opts?: FlyerExtractOptions,
  ): Promise<Deal[]>;
}

export type FlyerExtractionFailure =
  | 'unreadable_file'
  | 'no_deals_found'
  | 'error';

/**
 * Persisted overlay of user-uploaded flyer deals, keyed by FSA. Each entry
 * REPLACES all seeded deals for its store. Stores only Deal[] + fileName
 * metadata — never a File/Blob/object URL.
 */
export interface FlyerOverlay {
  fsa: string;
  entries: Record<string /* storeId */, { fileName: string; deals: Deal[] }>;
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
  getFlyerOverlay(postal: string): Promise<FlyerOverlay | null>;
  saveFlyerOverlay(o: FlyerOverlay): Promise<void>;
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
