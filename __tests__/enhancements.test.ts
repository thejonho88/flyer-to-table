import type {
  DiscoveryEvent,
  DiscoveryResult,
  MealPlan,
  PersistenceAdapter,
  PlanPreferences,
} from '@/domain/types';
import { MockDiscoveryAgent } from '@/services/MockDiscoveryAgent';
import {
  CHAIN_CATALOG,
  CHAIN_DEAL_SEEDS,
  addedStoreIdFor,
  getSeededArea,
  makeAddedStore,
  mergeAddedStores,
  rebuildAddedStoreFromId,
} from '@/data/deals';
import { BASE_PRICES } from '@/data/pricing';
import { getIngredient, isPantryStaple } from '@/data/ingredients';
import { buildPlanContext } from '@/domain/context';
import { generatePlan } from '@/domain/planner';
import { buildShoppingList } from '@/domain/shoppingList';
import { recipePassesHardConstraints } from '@/domain/filters';
import { getRecipe } from '@/data/recipes';
import { formatUnitPrice } from '@/domain/format';
import {
  isStepReachable,
  nextReachableStep,
  prevReachableStep,
} from '@/domain/onboardingSteps';

/* --------------------------- test helpers --------------------------- */

class MemoryPersistence implements PersistenceAdapter {
  prefs: PlanPreferences | null = null;
  discovery = new Map<string, DiscoveryResult>();
  plan: MealPlan | null = null;
  checklists = new Map<string, Record<string, boolean>>();

  async getPreferences() {
    return this.prefs;
  }
  async savePreferences(p: PlanPreferences) {
    this.prefs = p;
  }
  async getDiscoveryCache(postal: string) {
    return this.discovery.get(postal.slice(0, 3).toUpperCase()) ?? null;
  }
  async saveDiscoveryCache(r: DiscoveryResult) {
    this.discovery.set(r.postalCode.slice(0, 3).toUpperCase(), r);
  }
  async getCurrentPlan() {
    return this.plan;
  }
  async saveCurrentPlan(p: MealPlan) {
    this.plan = p;
  }
  async getChecklist(planId: string) {
    return this.checklists.get(planId) ?? {};
  }
  async saveChecklist(planId: string, s: Record<string, boolean>) {
    this.checklists.set(planId, s);
  }
}

function agent(persist: PersistenceAdapter, now = () => Date.now()) {
  return new MockDiscoveryAgent(persist, { latencyScale: 0, now });
}

function prefsFor(result: DiscoveryResult, selectedStoreIds: string[]): PlanPreferences {
  return {
    postalCode: result.postalCode,
    selectedStoreIds,
    householdSize: 4,
    dietaryRestrictions: [],
    maxCookTimeMinutes: null,
    leftoversForLunch: false,
    dinnersPerWeek: 7,
  };
}

/* ----------------------------- formatUnitPrice ---------------------------- */

describe('formatUnitPrice', () => {
  it('renders per-gram prices as a per-100 g price', () => {
    expect(formatUnitPrice(0.033, 'g')).toBe('$3.30/100 g');
    expect(formatUnitPrice(0.025, 'g')).toBe('$2.50/100 g');
  });

  it('renders normal unit prices as plain dollars with two decimals', () => {
    expect(formatUnitPrice(4.29, 'tub')).toBe('$4.29');
    expect(formatUnitPrice(2, 'box')).toBe('$2.00');
    expect(formatUnitPrice(1.5, 'unit')).toBe('$1.50');
  });
});

/* ------------------------------ seed sanity ------------------------------- */

describe('CHAIN_DEAL_SEEDS', () => {
  it('covers every chain in the catalog', () => {
    for (const chain of CHAIN_CATALOG) {
      expect(CHAIN_DEAL_SEEDS[chain]).toBeDefined();
      expect(CHAIN_DEAL_SEEDS[chain].length).toBeGreaterThan(0);
    }
  });

  it('uses only valid ingredient ids with realistic 15–40% discounts', () => {
    for (const chain of CHAIN_CATALOG) {
      for (const [ingredientId, salePrice] of CHAIN_DEAL_SEEDS[chain]) {
        const base = BASE_PRICES[ingredientId];
        expect(base).toBeDefined();
        expect(getIngredient(ingredientId)).toBeDefined();
        expect(salePrice).toBeLessThan(base.unitPrice);
        const pct = (1 - salePrice / base.unitPrice) * 100;
        expect(pct).toBeGreaterThanOrEqual(15);
        expect(pct).toBeLessThanOrEqual(40);
      }
    }
  });
});

/* ------------------------------ makeAddedStore ---------------------------- */

describe('makeAddedStore / id round-trip', () => {
  it('produces a deterministic id and rebuildable bundle', () => {
    const a = makeAddedStore('loblaws', 'H2X');
    const b = makeAddedStore('loblaws', 'H2X');
    expect(a.store.id).toBe('loblaws-h2x-added');
    expect(addedStoreIdFor('loblaws', 'H2X')).toBe('loblaws-h2x-added');
    expect(a.store.distanceKm).toBe(b.store.distanceKm);
    expect(a.store.name).toBe(b.store.name);
    expect(a.store.dealCount).toBe(a.deals.length);
    expect(a.deals.every((d) => d.storeId === 'loblaws-h2x-added')).toBe(true);

    const rebuilt = rebuildAddedStoreFromId(a.store.id);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.store).toEqual(a.store);
    expect(rebuilt!.deals).toEqual(a.deals);
  });

  it('rejects non-added / malformed ids', () => {
    expect(rebuildAddedStoreFromId('metro-h2x')).toBeNull();
    expect(rebuildAddedStoreFromId('bogus-h2x-added')).toBeNull();
    expect(rebuildAddedStoreFromId('loblaws-added')).toBeNull();
  });
});

/* ------------------------------ mergeAddedStores -------------------------- */

describe('mergeAddedStores', () => {
  it('re-merges a selected added store missing from the result', () => {
    const area = getSeededArea('H2X')!;
    const result: DiscoveryResult = {
      postalCode: 'H2X 1Y4',
      stores: area.stores,
      deals: area.deals,
      fetchedAt: new Date().toISOString(),
      source: 'live',
    };
    const id = addedStoreIdFor('walmart', 'H2X');
    const merged = mergeAddedStores(result, [...area.stores.map((s) => s.id), id]);

    expect(merged).not.toBe(result); // new object
    expect(merged.stores.some((s) => s.id === id)).toBe(true);
    expect(merged.deals.some((d) => d.storeId === id)).toBe(true);
  });

  it('is a no-op (same reference) when nothing to merge', () => {
    const area = getSeededArea('H2X')!;
    const result: DiscoveryResult = {
      postalCode: 'H2X 1Y4',
      stores: area.stores,
      deals: area.deals,
      fetchedAt: new Date().toISOString(),
      source: 'live',
    };
    expect(mergeAddedStores(result, area.stores.map((s) => s.id))).toBe(result);
  });
});

/* --------------------- addStore end-to-end via the agent ------------------ */

describe('added store integrates with discovery + planner', () => {
  async function liveResult(persist: PersistenceAdapter): Promise<DiscoveryResult> {
    return agent(persist).discover('H2X 1Y4');
  }

  it('merges store + deals into the result and persisted cache', async () => {
    const persist = new MemoryPersistence();
    const base = await liveResult(persist);
    const { store, deals } = makeAddedStore('walmart', 'H2X');

    const updated: DiscoveryResult = {
      ...base,
      stores: [...base.stores, store],
      deals: [...base.deals, ...deals],
    };
    await persist.saveDiscoveryCache(updated);

    const cached = await persist.getDiscoveryCache('H2X 1Y4');
    expect(cached!.stores.some((s) => s.id === store.id)).toBe(true);
    expect(cached!.deals.some((d) => d.storeId === store.id)).toBe(true);
  });

  it('rehydration restores the added store from cache', async () => {
    const persist = new MemoryPersistence();
    const base = await liveResult(persist);
    const { store, deals } = makeAddedStore('loblaws', 'H2X');
    await persist.saveDiscoveryCache({
      ...base,
      stores: [...base.stores, store],
      deals: [...base.deals, ...deals],
    });

    // getCached is what hydrateFor calls under the hood.
    const rehydrated = await agent(persist).getCached('H2X 1Y4');
    expect(rehydrated!.stores.some((s) => s.id === store.id)).toBe(true);
  });

  it('planner context includes the added store deals and invariants hold', async () => {
    const persist = new MemoryPersistence();
    const base = await liveResult(persist);
    const { store, deals } = makeAddedStore('walmart', 'H2X');
    const result: DiscoveryResult = {
      ...base,
      stores: [...base.stores, store],
      deals: [...base.deals, ...deals],
    };

    const prefs = prefsFor(result, result.stores.map((s) => s.id));
    prefs.dietaryRestrictions = ['vegetarian'];
    prefs.maxCookTimeMinutes = 30;

    const ctx = buildPlanContext(result, prefs);
    expect(ctx.deals.some((d) => d.storeId === store.id)).toBe(true);

    const plan = generatePlan(ctx);
    for (const meal of plan.meals) {
      const recipe = getRecipe(meal.recipeId)!;
      expect(recipePassesHardConstraints(recipe, ['vegetarian'], 30)).toBe(true);
    }

    const list = buildShoppingList(plan, ctx);
    for (const g of list.storeGroups) {
      for (const item of g.items) {
        expect(isPantryStaple(item.ingredientId)).toBe(false);
      }
    }
  });

  it('re-merge mitigation: a forced re-discovery keeps a still-selected added store', async () => {
    const persist = new MemoryPersistence();
    const base = await liveResult(persist);
    const { store, deals } = makeAddedStore('walmart', 'H2X');
    await persist.saveDiscoveryCache({
      ...base,
      stores: [...base.stores, store],
      deals: [...base.deals, ...deals],
    });

    // Forced live re-discovery rebuilds from seeds -> added store absent...
    const rediscovered = await agent(persist).discover('H2X 1Y4', {
      forceRefresh: true,
    });
    expect(rediscovered.stores.some((s) => s.id === store.id)).toBe(false);

    // ...but the store-level re-merge (still-selected) restores it.
    const selectedIds = [...rediscovered.stores.map((s) => s.id), store.id];
    const merged = mergeAddedStores(rediscovered, selectedIds);
    expect(merged.stores.some((s) => s.id === store.id)).toBe(true);
    expect(merged.deals.some((d) => d.storeId === store.id)).toBe(true);
  });
});

/* --------------------------- reachability truth table --------------------- */

describe('onboarding step reachability', () => {
  const result = (postalCode: string): DiscoveryResult => ({
    postalCode,
    stores: [],
    deals: [],
    fetchedAt: new Date().toISOString(),
    source: 'live',
  });
  const prefs = (postalCode: string, selectedStoreIds: string[]): PlanPreferences => ({
    postalCode,
    selectedStoreIds,
    householdSize: 4,
    dietaryRestrictions: [],
    maxCookTimeMinutes: null,
    leftoversForLunch: false,
    dinnersPerWeek: 7,
  });

  it('postal is always reachable; discovery is never a target', () => {
    const input = { result: null, prefs: null };
    expect(isStepReachable(0, input)).toBe(true);
    expect(isStepReachable(1, input)).toBe(false);
  });

  it('no result: only postal reachable', () => {
    const input = { result: null, prefs: prefs('H2X 1Y4', []) };
    expect(isStepReachable(2, input)).toBe(false);
    expect(isStepReachable(3, input)).toBe(false);
  });

  it('result for another FSA does not unlock stores', () => {
    const input = { result: result('H3B 1A1'), prefs: prefs('H2X 1Y4', ['metro-h2x']) };
    expect(isStepReachable(2, input)).toBe(false);
    expect(isStepReachable(3, input)).toBe(false);
  });

  it('matching result but no persisted stores: stores reachable, prefs not', () => {
    const input = { result: result('H2X 1Y4'), prefs: prefs('H2X 1Y4', []) };
    expect(isStepReachable(2, input)).toBe(true);
    expect(isStepReachable(3, input)).toBe(false);
  });

  it('all present: stores and prefs reachable', () => {
    const input = { result: result('H2X 1Y4'), prefs: prefs('H2X 1Y4', ['metro-h2x']) };
    expect(isStepReachable(2, input)).toBe(true);
    expect(isStepReachable(3, input)).toBe(true);
  });

  it('arrows skip discovery: back from stores lands on postal', () => {
    const input = { result: result('H2X 1Y4'), prefs: prefs('H2X 1Y4', ['metro-h2x']) };
    expect(prevReachableStep(2, input)).toBe(0);
    expect(nextReachableStep(2, input)).toBe(3);
    expect(nextReachableStep(3, input)).toBeNull();
    expect(prevReachableStep(0, input)).toBeNull();
  });
});
