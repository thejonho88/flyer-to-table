import type {
  Deal,
  DiscoveryResult,
  FlyerExtractionEvent,
  FlyerOverlay,
  MealPlan,
  PersistenceAdapter,
  PlanPreferences,
  UploadedFlyerFile,
} from '@/domain/types';
import { MockFlyerExtractor, FlyerExtractionError } from '@/services/MockFlyerExtractor';
import { makeExtractedDeals } from '@/data/deals';
import { getIngredient } from '@/data/ingredients';
import { BASE_PRICES } from '@/data/pricing';
import {
  applyExtractedDeals,
  updateDealInResult,
  removeDealFromResult,
  applyOverlay,
} from '@/domain/flyerMerge';
import { LocalPersistenceAdapter } from '@/services/LocalPersistenceAdapter';
import { getSeededArea, mergeAddedStores, makeAddedStore } from '@/data/deals';
import {
  isStepReachable,
  nextReachableStep,
  prevReachableStep,
} from '@/domain/onboardingSteps';

/* ------------------------------- helpers -------------------------------- */

function extractor() {
  return new MockFlyerExtractor({ latencyScale: 0 });
}

function file(mimeType: string): UploadedFlyerFile {
  return { name: 'flyer.pdf', mimeType, size: 1234, uri: 'blob:should-not-be-read' };
}

/** A minimal fake kv-backed persistence, mirroring the discovery.test pattern. */
class MemoryPersistence implements PersistenceAdapter {
  prefs: PlanPreferences | null = null;
  discovery = new Map<string, DiscoveryResult>();
  overlays = new Map<string, FlyerOverlay>();
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
  async getFlyerOverlay(postal: string) {
    return this.overlays.get(postal.slice(0, 3).toUpperCase()) ?? null;
  }
  async saveFlyerOverlay(o: FlyerOverlay) {
    this.overlays.set(o.fsa.toUpperCase(), o);
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

function resultFor(postal: string): DiscoveryResult {
  const area = getSeededArea(postal.slice(0, 3))!;
  return {
    postalCode: postal,
    stores: area.stores.map((s) => ({ ...s })),
    deals: [...area.deals],
    fetchedAt: new Date().toISOString(),
    source: 'live',
  };
}

/* ----------------------------- extractor -------------------------------- */

describe('MockFlyerExtractor', () => {
  it('returns deals with valid ingredient ids, units, prices, ids, provenance', async () => {
    const deals = await extractor().extract({
      file: file('application/pdf'),
      storeId: 'metro-h2x',
      chain: 'metro',
    });

    expect(deals.length).toBeGreaterThan(0);
    for (const d of deals) {
      expect(getIngredient(d.ingredientId)).toBeDefined();
      expect(BASE_PRICES[d.ingredientId]).toBeDefined();
      expect(d.id).toBe(`metro-h2x__${d.ingredientId}`);
      expect(d.storeId).toBe('metro-h2x');
      expect(d.provenance).toBe('extracted');
      expect(d.salePrice).toBeGreaterThan(0);
      expect(d.salePrice).toBeLessThanOrEqual(d.regularPrice);
      expect(typeof d.unit).toBe('string');
    }
  });

  it('is deterministic for the same store/chain', async () => {
    const a = await extractor().extract({
      file: file('image/png'),
      storeId: 'metro-h2x',
      chain: 'metro',
    });
    const b = await extractor().extract({
      file: file('image/jpeg'),
      storeId: 'metro-h2x',
      chain: 'metro',
    });
    expect(a.map((d) => d.id)).toEqual(b.map((d) => d.id));
    expect(a.map((d) => d.salePrice)).toEqual(b.map((d) => d.salePrice));
  });

  it('emits visible progress events (0..1)', async () => {
    const events: FlyerExtractionEvent[] = [];
    await extractor().extract(
      { file: file('application/pdf'), storeId: 'iga-h2x', chain: 'iga' },
      { onEvent: (e) => events.push(e) },
    );
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.type === 'status')).toBe(true);
    expect(events.every((e) => e.progress >= 0 && e.progress <= 1)).toBe(true);
    expect(events[events.length - 1].progress).toBe(1);
  });

  it('fails LOUDLY with unreadable_file for an unsupported mime type', async () => {
    await expect(
      extractor().extract({
        file: file('text/csv'),
        storeId: 'metro-h2x',
        chain: 'metro',
      }),
    ).rejects.toBeInstanceOf(FlyerExtractionError);
    await expect(
      extractor().extract({
        file: file('text/csv'),
        storeId: 'metro-h2x',
        chain: 'metro',
      }),
    ).rejects.toMatchObject({ reason: 'unreadable_file' });
  });
});

/* ------------------------------- merge ---------------------------------- */

describe('flyerMerge', () => {
  it('replaces all of a store\'s deals by storeId and recomputes dealCount', () => {
    const result = resultFor('H2X 1Y4');
    const storeId = 'metro-h2x';
    const seededCount = result.deals.filter((d) => d.storeId === storeId).length;
    const otherStore = result.stores.find((s) => s.id !== storeId)!;
    const otherCountBefore = result.deals.filter(
      (d) => d.storeId === otherStore.id,
    ).length;

    const extracted = makeExtractedDeals(storeId, 'metro');
    const next = applyExtractedDeals(result, storeId, extracted);

    // seeded deals for this store are gone; only extracted remain
    const nextForStore = next.deals.filter((d) => d.storeId === storeId);
    expect(nextForStore.every((d) => d.provenance === 'extracted')).toBe(true);
    expect(nextForStore.length).toBe(extracted.length);
    expect(nextForStore.length).not.toBe(seededCount + extracted.length);

    // dealCount recomputed for the replaced store, untouched for others
    const store = next.stores.find((s) => s.id === storeId)!;
    expect(store.dealCount).toBe(extracted.length);
    const other = next.stores.find((s) => s.id === otherStore.id)!;
    expect(other.dealCount).toBe(otherCountBefore);

    // pure: original result untouched
    expect(result.deals.filter((d) => d.storeId === storeId).length).toBe(
      seededCount,
    );
  });

  it('editing a deal clamps salePrice to regularPrice and marks it edited', () => {
    const result = resultFor('H2X 1Y4');
    const target = result.deals.find((d) => d.storeId === 'metro-h2x')!;
    const next = updateDealInResult(result, target.id, {
      salePrice: target.regularPrice + 100,
    });
    const edited = next.deals.find((d) => d.id === target.id)!;
    expect(edited.salePrice).toBe(edited.regularPrice);
    expect(edited.provenance).toBe('edited');
  });

  it('removing a deal drops it and recomputes dealCount', () => {
    const result = resultFor('H2X 1Y4');
    const target = result.deals.find((d) => d.storeId === 'metro-h2x')!;
    const before = next(result, 'metro-h2x');
    const removed = removeDealFromResult(result, target.id);
    expect(removed.deals.some((d) => d.id === target.id)).toBe(false);
    expect(next(removed, 'metro-h2x')).toBe(before - 1);
  });

  function next(r: DiscoveryResult, storeId: string): number {
    return r.stores.find((s) => s.id === storeId)!.dealCount;
  }
});

/* ---------------------------- persistence ------------------------------- */

describe('flyer overlay persistence', () => {
  it('survives a save/get round-trip and re-applies onto a fresh result', async () => {
    const persist = new LocalPersistenceAdapter();
    const storeId = 'metro-h2x';
    const deals = makeExtractedDeals(storeId, 'metro');
    const overlay: FlyerOverlay = {
      fsa: 'H2X',
      entries: { [storeId]: { fileName: 'my-flyer.pdf', deals } },
    };
    await persist.saveFlyerOverlay(overlay);

    const loaded = await persist.getFlyerOverlay('H2X 1Y4');
    expect(loaded).not.toBeNull();
    expect(loaded!.entries[storeId].fileName).toBe('my-flyer.pdf');
    // never stores an object URL — only deals + fileName metadata
    const json = JSON.stringify(loaded);
    expect(json).not.toContain('blob:');

    // re-apply onto a fresh (seeded) result: seeded deals replaced
    const fresh = resultFor('H2X 1Y4');
    const applied = applyOverlay(fresh, loaded!);
    const forStore = applied.deals.filter((d) => d.storeId === storeId);
    expect(forStore.every((d) => d.provenance === 'extracted')).toBe(true);
    expect(applied.stores.find((s) => s.id === storeId)!.dealCount).toBe(
      deals.length,
    );
  });

  it('overlay is re-applied after a forced re-discovery (never silently dropped)', () => {
    // Simulate: a re-discovery rebuilt the result from seeds; overlay must return.
    const rebuilt = resultFor('H2X 1Y4');
    const storeId = 'metro-h2x';
    const deals = makeExtractedDeals(storeId, 'metro');
    const overlay: FlyerOverlay = {
      fsa: 'H2X',
      entries: { [storeId]: { fileName: 'f.pdf', deals } },
    };
    const restored = applyOverlay(rebuilt, overlay);
    const forStore = restored.deals.filter((d) => d.storeId === storeId);
    expect(forStore).toHaveLength(deals.length);
    expect(forStore.every((d) => d.provenance === 'extracted')).toBe(true);
  });

  it('overlay composes with mergeAddedStores (applies on top of an added store)', () => {
    const base = resultFor('H2X 1Y4');
    // add a store that is not seeded in H2X, then overlay a flyer onto it
    const { store } = makeAddedStore('loblaws', 'H2X');
    const withAdded = mergeAddedStores(base, [
      ...base.stores.map((s) => s.id),
      store.id,
    ]);
    expect(withAdded.stores.some((s) => s.id === store.id)).toBe(true);

    const deals = makeExtractedDeals(store.id, 'loblaws');
    const overlay: FlyerOverlay = {
      fsa: 'H2X',
      entries: { [store.id]: { fileName: 'loblaws.pdf', deals } },
    };
    const composed = applyOverlay(withAdded, overlay);
    const forStore = composed.deals.filter((d) => d.storeId === store.id);
    expect(forStore.every((d) => d.provenance === 'extracted')).toBe(true);
    expect(composed.stores.find((s) => s.id === store.id)!.dealCount).toBe(
      deals.length,
    );
  });
});

/* --------------------- onboarding steps truth table --------------------- */

describe('onboarding steps with flyers step', () => {
  const result = (postalCode: string): DiscoveryResult => ({
    postalCode,
    stores: [],
    deals: [],
    fetchedAt: new Date().toISOString(),
    source: 'live',
  });
  const prefs = (
    postalCode: string,
    selectedStoreIds: string[],
  ): PlanPreferences => ({
    postalCode,
    selectedStoreIds,
    householdSize: 4,
    dietaryRestrictions: [],
    maxCookTimeMinutes: null,
    leftoversForLunch: false,
    dinnersPerWeek: 7,
  });

  it('flyers (3) and prefs (4) share the same gate; neither is gated on uploads', () => {
    const gated = { result: result('H2X 1Y4'), prefs: prefs('H2X 1Y4', []) };
    expect(isStepReachable(3, gated)).toBe(false);
    expect(isStepReachable(4, gated)).toBe(false);

    const open = { result: result('H2X 1Y4'), prefs: prefs('H2X 1Y4', ['metro-h2x']) };
    expect(isStepReachable(3, open)).toBe(true);
    expect(isStepReachable(4, open)).toBe(true);
  });

  it('flyers is a normal nav target between stores and prefs', () => {
    const input = { result: result('H2X 1Y4'), prefs: prefs('H2X 1Y4', ['metro-h2x']) };
    expect(nextReachableStep(2, input)).toBe(3);
    expect(nextReachableStep(3, input)).toBe(4);
    expect(prevReachableStep(4, input)).toBe(3);
    expect(prevReachableStep(3, input)).toBe(2);
    expect(nextReachableStep(4, input)).toBeNull();
  });
});
