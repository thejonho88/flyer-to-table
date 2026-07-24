import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Deal,
  DiscoveryResult,
  FlyerOverlay,
  MealPlan,
  PlanContext,
  Recipe,
  Store,
} from '@/domain/types';
import {
  CHAIN_CATALOG,
  addableChains,
  addedStoreIdFor,
  getSeededArea,
} from '@/data/deals';
import { buildShoppingList, itemKey } from '@/domain/shoppingList';
import { INGREDIENTS } from '@/data/ingredients';
import { useDiscoveryStore } from '@/state/discoveryStore';
import { usePreferencesStore, defaultPreferences } from '@/state/preferencesStore';
import { persistence } from '@/services/LocalPersistenceAdapter';

/* ------------------------------------------------------------------ */
/* Fixtures                                                           */
/* ------------------------------------------------------------------ */

const POSTAL = 'H2X 1Y4'; // fsaOf -> H2X (a seeded area with metro/iga/provigo/maxi/superc)

/** A real seeded H2X discovery result (walmart & loblaws are never seeded). */
function seededResult(): DiscoveryResult {
  const area = getSeededArea('H2X')!;
  return {
    postalCode: POSTAL,
    stores: area.stores,
    deals: area.deals,
    fetchedAt: new Date('2026-07-20T00:00:00Z').toISOString(),
    source: 'live',
  };
}

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

const STORE_A: Store = { id: 'metro-h2x', chain: 'metro', name: 'Metro', distanceKm: 0.6, dealCount: 2 };
const STORE_B: Store = { id: 'walmart-h2x-added', chain: 'walmart', name: 'Walmart', distanceKm: 2.5, dealCount: 1 };

/** One meal using broccoli (sold at both stores) + greek_yogurt (store A only). */
const TEST_RECIPE: Recipe = {
  id: 'r1',
  name: 'Test',
  image: 0,
  cookTimeMinutes: 20,
  baseServings: 2,
  dietaryTags: [],
  supportsLeftovers: false,
  ingredients: [
    { ingredientId: 'broccoli', quantity: 1, unit: 'bunch' },
    { ingredientId: 'greek_yogurt', quantity: 1, unit: 'tub' },
  ],
};

const TEST_PLAN: MealPlan = {
  id: 'p1',
  weekOf: '2026-07-20',
  meals: [
    { day: 0, recipeId: 'r1', servings: 2, estimatedCost: 0, regularCost: 0, saleIngredientIds: [] },
  ],
  totals: { estimated: 0, regular: 0, savings: 0, savingsPct: 0 },
};

/** PlanContext with a cheaper broccoli deal at the (addable) walmart store. */
function ctxWith(selectedStoreIds: string[]): PlanContext {
  return {
    deals: [
      deal('metro-h2x', 'broccoli', 1.99, 2.49, 'bunch'),
      deal('metro-h2x', 'greek_yogurt', 3.29, 3.99, 'tub'),
      deal('walmart-h2x-added', 'broccoli', 0.99, 2.49, 'bunch'),
    ],
    stores: [STORE_A, STORE_B],
    recipes: [TEST_RECIPE],
    ingredients: INGREDIENTS,
    prefs: defaultPreferences(POSTAL, selectedStoreIds),
  };
}

function groupFor(list: ReturnType<typeof buildShoppingList>, ingredientId: string) {
  return list.storeGroups.find((g) => g.items.some((i) => i.ingredientId === ingredientId));
}

function allKeys(list: ReturnType<typeof buildShoppingList>): string[] {
  return list.storeGroups.flatMap((g) =>
    g.items.map((i) => itemKey(g.store.id, i.ingredientId)),
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useDiscoveryStore.setState({
    status: 'idle',
    progress: 0,
    foundStores: [],
    result: null,
    error: undefined,
    phase: undefined,
    message: undefined,
  });
  usePreferencesStore.setState({ preferences: null, hydrated: false });
});

/* ------------------------------------------------------------------ */
/* (e) addableChains derivation                                        */
/* ------------------------------------------------------------------ */

describe('addableChains', () => {
  it('returns the full catalog when no stores are present', () => {
    expect(addableChains([])).toEqual(CHAIN_CATALOG);
  });

  it('filters out chains already represented among the stores', () => {
    const present: Store[] = [
      { ...STORE_A, chain: 'metro' },
      { id: 'iga-h2x', chain: 'iga', name: 'IGA', distanceKm: 1, dealCount: 0 },
    ];
    expect(addableChains(present)).toEqual(['provigo', 'maxi', 'superc', 'loblaws', 'walmart']);
  });

  it('returns [] when every catalog chain is already present', () => {
    const all: Store[] = CHAIN_CATALOG.map((c, i) => ({
      id: `${c}-s`,
      chain: c,
      name: c,
      distanceKm: i,
      dealCount: 0,
    }));
    expect(addableChains(all)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* (a) addStoreAndSelect appends + persists selection, idempotent      */
/* ------------------------------------------------------------------ */

describe('addStoreAndSelect', () => {
  it('appends the store + deals AND persists the selection, idempotently', async () => {
    const base = seededResult();
    useDiscoveryStore.setState({ status: 'success', result: base, foundStores: base.stores, progress: 1 });
    usePreferencesStore.setState({
      preferences: defaultPreferences(POSTAL, base.stores.map((s) => s.id)),
      hydrated: true,
    });

    const id = addedStoreIdFor('walmart', 'H2X');
    await useDiscoveryStore.getState().addStoreAndSelect('walmart');

    const result = useDiscoveryStore.getState().result!;
    expect(result.stores.some((s) => s.id === id)).toBe(true);
    expect(result.deals.some((d) => d.storeId === id)).toBe(true);

    const sel = usePreferencesStore.getState().preferences!.selectedStoreIds;
    expect(sel).toContain(id);

    const storeCount = result.stores.length;
    const selCount = sel.length;

    // Repeat: no duplicate store, no duplicate selection.
    await useDiscoveryStore.getState().addStoreAndSelect('walmart');
    expect(useDiscoveryStore.getState().result!.stores.length).toBe(storeCount);
    expect(useDiscoveryStore.getState().result!.stores.filter((s) => s.id === id)).toHaveLength(1);
    expect(usePreferencesStore.getState().preferences!.selectedStoreIds.length).toBe(selCount);
  });
});

/* ------------------------------------------------------------------ */
/* (b) + (c) buildShoppingList re-routing and checklist-key stability  */
/* ------------------------------------------------------------------ */

describe('buildShoppingList after adding a cheaper store', () => {
  it('re-routes an ingredient to the cheaper new store only once it is selected', () => {
    const before = buildShoppingList(TEST_PLAN, ctxWith(['metro-h2x']));
    expect(groupFor(before, 'broccoli')!.store.id).toBe('metro-h2x');

    const after = buildShoppingList(TEST_PLAN, ctxWith(['metro-h2x', 'walmart-h2x-added']));
    expect(groupFor(after, 'broccoli')!.store.id).toBe('walmart-h2x-added');
  });

  it('leaves checklist keys for non-re-routed rows unchanged; re-routed rows reset', () => {
    const before = buildShoppingList(TEST_PLAN, ctxWith(['metro-h2x']));
    const after = buildShoppingList(TEST_PLAN, ctxWith(['metro-h2x', 'walmart-h2x-added']));

    const beforeKeys = allKeys(before);
    const afterKeys = allKeys(after);

    // greek_yogurt is only at metro-h2x -> not re-routed -> key stable.
    const stable = itemKey('metro-h2x', 'greek_yogurt');
    expect(beforeKeys).toContain(stable);
    expect(afterKeys).toContain(stable);

    // broccoli re-routes: old key gone, new key present (reset is acceptable).
    expect(beforeKeys).toContain(itemKey('metro-h2x', 'broccoli'));
    expect(afterKeys).toContain(itemKey('walmart-h2x-added', 'broccoli'));
    expect(afterKeys).not.toContain(itemKey('metro-h2x', 'broccoli'));
  });
});

/* ------------------------------------------------------------------ */
/* (d) flyer overlay untouched by addStore, still applied on rehydrate */
/* ------------------------------------------------------------------ */

describe('flyer overlay interaction with addStore', () => {
  const MARKER = deal('metro-h2x', 'broccoli', 0.11, 2.49, 'bunch');
  const overlay = (): FlyerOverlay => ({
    fsa: 'H2X',
    entries: { 'metro-h2x': { fileName: 'flyer.pdf', deals: [{ ...MARKER }] } },
  });

  it('does not mutate the persisted overlay and re-applies it after rehydrate', async () => {
    const base = seededResult();
    await persistence.saveDiscoveryCache(base);
    await persistence.saveFlyerOverlay(overlay());
    usePreferencesStore.setState({
      preferences: defaultPreferences(POSTAL, base.stores.map((s) => s.id)),
      hydrated: true,
    });

    // Hydrate applies the overlay: metro-h2x's deals become just the marker.
    await useDiscoveryStore.getState().hydrateFor(POSTAL);
    const hydrated = useDiscoveryStore.getState().result!;
    expect(hydrated.deals.filter((d) => d.storeId === 'metro-h2x')).toEqual([MARKER]);

    // Adding a store must not touch the overlay, nor drop the overlaid deals.
    await useDiscoveryStore.getState().addStore('walmart');
    expect(await persistence.getFlyerOverlay(POSTAL)).toEqual(overlay());
    const afterAdd = useDiscoveryStore.getState().result!;
    expect(afterAdd.deals.filter((d) => d.storeId === 'metro-h2x')).toEqual([MARKER]);
    expect(afterAdd.stores.some((s) => s.id === addedStoreIdFor('walmart', 'H2X'))).toBe(true);

    // Rehydrate from scratch: the overlay is still applied on top of the cache.
    useDiscoveryStore.setState({ result: null, status: 'idle' });
    await useDiscoveryStore.getState().hydrateFor(POSTAL);
    const rehydrated = useDiscoveryStore.getState().result!;
    expect(rehydrated.deals.filter((d) => d.storeId === 'metro-h2x')).toEqual([MARKER]);
  });
});
