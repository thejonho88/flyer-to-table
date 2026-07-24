import type {
  Deal,
  MealPlan,
  PlanContext,
  PlanPreferences,
  Recipe,
  Store,
} from '@/domain/types';
import { buildPlanContext } from '@/domain/context';
import { buildShoppingList } from '@/domain/shoppingList';
import { compareOneStopTotals } from '@/domain/storeComparison';
import { defaultPreferences } from '@/state/preferencesStore';

/* ------------------------------------------------------------------ */
/* Fixtures                                                           */
/* ------------------------------------------------------------------ */

const POSTAL = 'H2X 1Y4';

const STORE_METRO: Store = { id: 'metro-h2x', chain: 'metro', name: 'Metro', distanceKm: 0.6, dealCount: 2 };
const STORE_WALMART: Store = { id: 'walmart-h2x', chain: 'walmart', name: 'Walmart', distanceKm: 2.5, dealCount: 1 };
// A store with NO deals at all — its one-stop total must be all base prices.
const STORE_IGA: Store = { id: 'iga-h2x', chain: 'iga', name: 'IGA', distanceKm: 1.5, dealCount: 0 };
const STORES = [STORE_METRO, STORE_WALMART, STORE_IGA];

function deal(
  storeId: string,
  ingredientId: string,
  salePrice: number,
  regularPrice: number,
  unit: string,
): Deal {
  return {
    id: `${storeId}__${ingredientId}`,
    storeId,
    ingredientId,
    label: ingredientId,
    salePrice,
    regularPrice,
    unit,
    validFrom: '2026-07-20',
    validTo: '2026-07-31',
  };
}

// broccoli cheaper at Walmart; greek_yogurt only on sale at Metro; onion has no
// deal (base 0.60/unit); base prices: broccoli 2.49/bunch, greek_yogurt 4.29/tub.
const DEALS: Deal[] = [
  deal('metro-h2x', 'broccoli', 1.99, 2.49, 'bunch'),
  deal('walmart-h2x', 'broccoli', 0.99, 2.49, 'bunch'),
  deal('metro-h2x', 'greek_yogurt', 3.29, 3.99, 'tub'),
];

const RECIPE: Recipe = {
  id: 'r1',
  name: 'Test',
  image: 0,
  cookTimeMinutes: 20,
  baseServings: 4,
  dietaryTags: [],
  supportsLeftovers: false,
  ingredients: [
    { ingredientId: 'broccoli', quantity: 1, unit: 'bunch' },
    { ingredientId: 'onion', quantity: 2, unit: 'unit' },
    { ingredientId: 'greek_yogurt', quantity: 1, unit: 'tub' },
  ],
};

const PLAN: MealPlan = {
  id: 'p1',
  weekOf: '2026-07-20',
  meals: [{ day: 0, recipeId: 'r1', servings: 4, estimatedCost: 0, regularCost: 0, saleIngredientIds: [] }],
  totals: { estimated: 0, regular: 0, savings: 0, savingsPct: 0 },
};

/** Multi-store context (candidate universe = selectedStoreIds), test recipe. */
function multiCtx(selectedStoreIds: string[] = STORES.map((s) => s.id)): PlanContext {
  const prefs: PlanPreferences = {
    ...defaultPreferences(POSTAL, selectedStoreIds),
    shoppingMode: 'multi',
  };
  const built = buildPlanContext({ deals: DEALS, stores: STORES }, prefs);
  return { ...built, recipes: [RECIPE] };
}

function totalFor(cmp: ReturnType<typeof compareOneStopTotals>, storeId: string) {
  return cmp.perStore.find((p) => p.store.id === storeId)?.total;
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

describe('compareOneStopTotals', () => {
  it('multiTotal equals the current multi-store list total', () => {
    const ctx = multiCtx();
    const cmp = compareOneStopTotals(PLAN, ctx);
    // broccoli @ Walmart 0.99 + onion base 2×0.60 + greek_yogurt @ Metro 3.29.
    expect(cmp.multiTotal).toBe(5.48);
    expect(cmp.multiTotal).toBe(buildShoppingList(PLAN, ctx).totals.estimated);
  });

  it('computes correct one-stop totals per candidate store', () => {
    const cmp = compareOneStopTotals(PLAN, multiCtx());
    // Metro: broccoli 1.99 + onion 1.20 + greek_yogurt 3.29 = 6.48.
    expect(totalFor(cmp, 'metro-h2x')).toBe(6.48);
    // Walmart: broccoli 0.99 + onion 1.20 + greek_yogurt base 4.29 = 6.48.
    expect(totalFor(cmp, 'walmart-h2x')).toBe(6.48);
  });

  it('prices the whole basket at base prices for a store with no deals', () => {
    const cmp = compareOneStopTotals(PLAN, multiCtx());
    // IGA has no deals: broccoli 2.49 + onion 1.20 + greek_yogurt 4.29 = 7.98.
    expect(totalFor(cmp, 'iga-h2x')).toBe(7.98);
  });

  it('shows the multi-store trip beating every single-store total here', () => {
    const cmp = compareOneStopTotals(PLAN, multiCtx());
    for (const p of cmp.perStore) {
      expect(cmp.multiTotal).toBeLessThan(p.total);
    }
  });

  it('sorts candidates cheapest first (distance as tiebreak)', () => {
    const cmp = compareOneStopTotals(PLAN, multiCtx());
    const totals = cmp.perStore.map((p) => p.total);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    // Metro & Walmart tie at 6.48; the nearer store (Metro) wins the tiebreak.
    expect(cmp.perStore[0].store.id).toBe('metro-h2x');
  });

  it('derives the candidate universe from selectedStoreIds', () => {
    const cmp = compareOneStopTotals(PLAN, multiCtx(['metro-h2x', 'walmart-h2x']));
    const ids = cmp.perStore.map((p) => p.store.id).sort();
    expect(ids).toEqual(['metro-h2x', 'walmart-h2x']);
  });
});
