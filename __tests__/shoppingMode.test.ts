import type {
  Deal,
  MealPlan,
  PlanContext,
  PlanPreferences,
  Recipe,
  Store,
} from '@/domain/types';
import { INGREDIENTS } from '@/data/ingredients';
import { buildPlanContext } from '@/domain/context';
import { resolveShoppingMode } from '@/domain/shoppingMode';
import { buildShoppingList, itemKey } from '@/domain/shoppingList';
import { getSwapAlternatives } from '@/domain/planner';
import { defaultPreferences } from '@/state/preferencesStore';

/* ------------------------------------------------------------------ */
/* Fixtures                                                           */
/* ------------------------------------------------------------------ */

const POSTAL = 'H2X 1Y4';

const STORE_METRO: Store = { id: 'metro-h2x', chain: 'metro', name: 'Metro', distanceKm: 0.6, dealCount: 2 };
const STORE_WALMART: Store = { id: 'walmart-h2x', chain: 'walmart', name: 'Walmart', distanceKm: 2.5, dealCount: 1 };
const STORES = [STORE_METRO, STORE_WALMART];

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

// broccoli is cheaper at Walmart; greek_yogurt is only on sale at Metro; onion
// has no deal anywhere (falls to base price).
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

function prefsWith(patch: Partial<PlanPreferences>): PlanPreferences {
  return { ...defaultPreferences(POSTAL, [STORE_METRO.id, STORE_WALMART.id]), ...patch };
}

/**
 * Real buildPlanContext (so single-mode narrowing is exercised end-to-end),
 * with the test recipe swapped in for the catalog.
 */
function ctxFor(prefs: PlanPreferences, recipes: Recipe[] = [RECIPE]): PlanContext {
  const built = buildPlanContext({ deals: DEALS, stores: STORES }, prefs);
  return { ...built, recipes };
}

function groupFor(list: ReturnType<typeof buildShoppingList>, ingredientId: string) {
  return list.storeGroups.find((g) => g.items.some((i) => i.ingredientId === ingredientId));
}
function itemFor(list: ReturnType<typeof buildShoppingList>, ingredientId: string) {
  for (const g of list.storeGroups) {
    const it = g.items.find((i) => i.ingredientId === ingredientId);
    if (it) return it;
  }
  return undefined;
}
function allKeys(list: ReturnType<typeof buildShoppingList>): string[] {
  return list.storeGroups.flatMap((g) => g.items.map((i) => itemKey(g.store.id, i.ingredientId)));
}

/* ------------------------------------------------------------------ */
/* resolveShoppingMode                                                */
/* ------------------------------------------------------------------ */

describe('resolveShoppingMode', () => {
  it('treats absent shoppingMode (old prefs) as multi with no warning', () => {
    const prefs = defaultPreferences(POSTAL, [STORE_METRO.id]);
    expect('shoppingMode' in prefs && prefs.shoppingMode).toBeFalsy();
    expect(resolveShoppingMode(prefs, STORES)).toEqual({ mode: 'multi' });
  });

  it('treats an explicit multi request as multi', () => {
    expect(resolveShoppingMode(prefsWith({ shoppingMode: 'multi' }), STORES)).toEqual({
      mode: 'multi',
    });
  });

  it('honours a valid single request', () => {
    const prefs = prefsWith({ shoppingMode: 'single', singleStoreId: 'metro-h2x' });
    expect(resolveShoppingMode(prefs, STORES)).toEqual({ mode: 'single', storeId: 'metro-h2x' });
  });

  it('falls back to multi AND reports invalid when singleStoreId is missing', () => {
    const prefs = prefsWith({ shoppingMode: 'single' });
    expect(resolveShoppingMode(prefs, STORES)).toEqual({ mode: 'multi', invalid: 'store_missing' });
  });

  it('reports invalid when singleStoreId is not among selectedStoreIds', () => {
    const prefs = {
      ...prefsWith({ shoppingMode: 'single', singleStoreId: 'walmart-h2x' }),
      selectedStoreIds: ['metro-h2x'],
    };
    expect(resolveShoppingMode(prefs, STORES)).toEqual({ mode: 'multi', invalid: 'store_missing' });
  });

  it('reports invalid when singleStoreId is gone from the discovery result', () => {
    const prefs = prefsWith({ shoppingMode: 'single', singleStoreId: 'walmart-h2x' });
    expect(resolveShoppingMode(prefs, [STORE_METRO])).toEqual({
      mode: 'multi',
      invalid: 'store_missing',
    });
  });
});

/* ------------------------------------------------------------------ */
/* buildPlanContext narrowing                                         */
/* ------------------------------------------------------------------ */

describe('buildPlanContext shopping-mode narrowing', () => {
  it('narrows selectedStoreIds to the single store in valid single mode', () => {
    const ctx = buildPlanContext(
      { deals: DEALS, stores: STORES },
      prefsWith({ shoppingMode: 'single', singleStoreId: 'metro-h2x' }),
    );
    expect(ctx.prefs.selectedStoreIds).toEqual(['metro-h2x']);
  });

  it('leaves selectedStoreIds intact in multi mode', () => {
    const ctx = buildPlanContext({ deals: DEALS, stores: STORES }, prefsWith({}));
    expect(ctx.prefs.selectedStoreIds).toEqual(['metro-h2x', 'walmart-h2x']);
  });

  it('leaves selectedStoreIds intact when the single request is invalid', () => {
    const ctx = buildPlanContext(
      { deals: DEALS, stores: STORES },
      prefsWith({ shoppingMode: 'single', singleStoreId: 'nope' }),
    );
    expect(ctx.prefs.selectedStoreIds).toEqual(['metro-h2x', 'walmart-h2x']);
  });
});

/* ------------------------------------------------------------------ */
/* Shopping list: multi vs single                                     */
/* ------------------------------------------------------------------ */

describe('buildShoppingList under shopping mode', () => {
  it('multi mode routes each item to its cheapest store (multiple groups)', () => {
    const list = buildShoppingList(PLAN, ctxFor(prefsWith({})));
    expect(list.storeGroups.length).toBe(2);
    // broccoli routes to the cheaper Walmart deal.
    expect(groupFor(list, 'broccoli')!.store.id).toBe('walmart-h2x');
    expect(itemFor(list, 'broccoli')!.unitPrice).toBe(0.99);
    // greek_yogurt's only deal is at Metro.
    expect(groupFor(list, 'greek_yogurt')!.store.id).toBe('metro-h2x');
  });

  it('single mode collapses to one group and restricts deals to that store', () => {
    const list = buildShoppingList(
      PLAN,
      ctxFor(prefsWith({ shoppingMode: 'single', singleStoreId: 'metro-h2x' })),
    );
    expect(list.storeGroups).toHaveLength(1);
    expect(list.storeGroups[0].store.id).toBe('metro-h2x');
    // The cheaper Walmart broccoli deal (0.99) is NOT available; Metro's is used.
    expect(itemFor(list, 'broccoli')!.unitPrice).toBe(1.99);
    expect(list.storeGroups[0].items.every((i) => i.unitPrice !== 0.99)).toBe(true);
  });

  it('single mode buckets base-priced items into the chosen store too', () => {
    const list = buildShoppingList(
      PLAN,
      ctxFor(prefsWith({ shoppingMode: 'single', singleStoreId: 'walmart-h2x' })),
    );
    expect(list.storeGroups).toHaveLength(1);
    expect(list.storeGroups[0].store.id).toBe('walmart-h2x');
    // onion has no deal -> base price, but still buckets into the single store.
    expect(groupFor(list, 'onion')!.store.id).toBe('walmart-h2x');
    // greek_yogurt's Metro-only deal is filtered out -> falls to base price.
    const gy = itemFor(list, 'greek_yogurt')!;
    expect(gy.onSale).toBe(false);
    expect(gy.unitPrice).toBe(4.29);
  });

  it('keeps checklist keys stable for rows already in the chosen store', () => {
    const multi = buildShoppingList(PLAN, ctxFor(prefsWith({})));
    const single = buildShoppingList(
      PLAN,
      ctxFor(prefsWith({ shoppingMode: 'single', singleStoreId: 'walmart-h2x' })),
    );
    const before = allKeys(multi);
    const after = allKeys(single);

    // broccoli was already at Walmart in multi -> key unchanged after switching.
    const stable = itemKey('walmart-h2x', 'broccoli');
    expect(before).toContain(stable);
    expect(after).toContain(stable);

    // greek_yogurt re-buckets Metro -> Walmart (key reset is accepted).
    expect(before).toContain(itemKey('metro-h2x', 'greek_yogurt'));
    expect(after).toContain(itemKey('walmart-h2x', 'greek_yogurt'));
    expect(after).not.toContain(itemKey('metro-h2x', 'greek_yogurt'));
  });
});

/* ------------------------------------------------------------------ */
/* Swap alternatives obey the mode                                    */
/* ------------------------------------------------------------------ */

describe('getSwapAlternatives under shopping mode', () => {
  const IN_PLAN: Recipe = {
    id: 'in',
    name: 'In plan',
    image: 0,
    cookTimeMinutes: 20,
    baseServings: 4,
    dietaryTags: [],
    supportsLeftovers: false,
    ingredients: [{ ingredientId: 'onion', quantity: 1, unit: 'unit' }],
  };
  const ALT: Recipe = {
    id: 'alt',
    name: 'Alt',
    image: 0,
    cookTimeMinutes: 20,
    baseServings: 4,
    dietaryTags: [],
    supportsLeftovers: false,
    ingredients: [{ ingredientId: 'greek_yogurt', quantity: 1, unit: 'tub' }],
  };
  const planInOnly: MealPlan = {
    ...PLAN,
    meals: [{ day: 0, recipeId: 'in', servings: 4, estimatedCost: 0, regularCost: 0, saleIngredientIds: [] }],
  };

  it('prices an alternative on the single store only, honouring its deals', () => {
    // Single = Metro (has the greek_yogurt deal 3.29) -> alternative is on sale.
    const metroAlt = getSwapAlternatives(
      planInOnly,
      0,
      ctxFor(prefsWith({ shoppingMode: 'single', singleStoreId: 'metro-h2x' }), [IN_PLAN, ALT]),
    ).find((a) => a.recipe.id === 'alt')!;
    expect(metroAlt.estimatedCost).toBe(3.29);
    expect(metroAlt.savings).toBeGreaterThan(0);

    // Single = Walmart (no greek_yogurt deal) -> priced at base 4.29, no savings.
    const walmartAlt = getSwapAlternatives(
      planInOnly,
      0,
      ctxFor(prefsWith({ shoppingMode: 'single', singleStoreId: 'walmart-h2x' }), [IN_PLAN, ALT]),
    ).find((a) => a.recipe.id === 'alt')!;
    expect(walmartAlt.estimatedCost).toBe(4.29);
    expect(walmartAlt.savings).toBe(0);
  });
});
