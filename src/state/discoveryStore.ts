import { create } from 'zustand';
import type {
  Chain,
  Deal,
  DiscoveryEvent,
  DiscoveryPhase,
  DiscoveryResult,
  FlyerOverlay,
  Store,
} from '@/domain/types';
import { fsaOf } from '@/domain/postal';
import {
  addedStoreIdFor,
  makeAddedStore,
  mergeAddedStores,
} from '@/data/deals';
import {
  applyExtractedDeals,
  applyOverlay,
  removeDealFromResult,
  updateDealInResult,
  type DealPatch,
} from '@/domain/flyerMerge';
import { discoveryAgent } from '@/services/MockDiscoveryAgent';
import { DiscoveryError } from '@/services/MockDiscoveryAgent';
import { persistence } from '@/services/LocalPersistenceAdapter';
import { usePreferencesStore } from './preferencesStore';

/**
 * Rebuild the persisted overlay entry for `storeId` from the current result so
 * edits/removes stay in sync with what will be re-applied after a
 * re-discovery. When `fileName` is omitted we only touch an entry that already
 * exists (a pure edit on a non-overlaid, seeded store must not fabricate one).
 */
async function syncOverlayEntry(
  result: DiscoveryResult,
  storeId: string,
  fileName?: string,
): Promise<void> {
  const overlay: FlyerOverlay =
    (await persistence.getFlyerOverlay(result.postalCode)) ?? {
      fsa: fsaOf(result.postalCode),
      entries: {},
    };
  const existing = overlay.entries[storeId];
  if (!existing && fileName == null) return;
  const deals = result.deals.filter((d) => d.storeId === storeId);
  overlay.entries[storeId] = {
    fileName: fileName ?? existing?.fileName ?? '',
    deals,
  };
  await persistence.saveFlyerOverlay(overlay);
}

type DiscoveryStatus = 'idle' | 'running' | 'success' | 'failed';

interface DiscoveryState {
  status: DiscoveryStatus;
  phase?: DiscoveryPhase;
  message?: string;
  progress: number;
  foundStores: Store[];
  result: DiscoveryResult | null;
  error?: { reason: 'no_flyers_found' | 'error'; message: string };

  /** Load a cached result for a postal code (no live run) if present. */
  hydrateFor: (postalCode: string) => Promise<DiscoveryResult | null>;
  /** Run the discovery agent with visible progress. */
  run: (
    postalCode: string,
    opts?: { forceRefresh?: boolean },
  ) => Promise<DiscoveryResult | null>;
  /** Append a user-added store (and its deals) to the current result. */
  addStore: (chain: Chain) => Promise<void>;
  /**
   * Append a user-added store AND persist it into the user's selected stores,
   * so its deals actually feed pricing and it survives re-discovery re-merge.
   * Idempotent end-to-end.
   */
  addStoreAndSelect: (chain: Chain) => Promise<void>;
  /** Replace a store's deals with those extracted from an uploaded flyer. */
  applyExtraction: (
    storeId: string,
    fileName: string,
    deals: Deal[],
  ) => Promise<void>;
  /** Hand-correct a single confirmed deal (clamps salePrice ≤ regularPrice). */
  editDeal: (dealId: string, patch: DealPatch) => Promise<void>;
  /** Permanently drop a single confirmed deal. */
  removeDeal: (dealId: string) => Promise<void>;
  reset: () => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  status: 'idle',
  progress: 0,
  foundStores: [],
  result: null,

  hydrateFor: async (postalCode) => {
    const cached = await discoveryAgent.getCached(postalCode);
    if (cached) {
      // The cache already includes any overlay (we persist post-apply), but
      // re-apply defensively so an upload is NEVER silently dropped on rehydrate.
      const overlay = await persistence.getFlyerOverlay(postalCode);
      const result = overlay ? applyOverlay(cached, overlay) : cached;
      set({
        status: 'success',
        result,
        foundStores: result.stores,
        progress: 1,
      });
      return result;
    }
    return cached;
  },

  run: async (postalCode, opts) => {
    set({
      status: 'running',
      progress: 0.02,
      foundStores: [],
      error: undefined,
      message: 'Starting…',
      phase: 'searching_stores',
    });

    const onEvent = (e: DiscoveryEvent) => {
      switch (e.type) {
        case 'status':
          set({ phase: e.phase, message: e.message, progress: e.progress });
          break;
        case 'store_found':
          set((s) => ({ foundStores: [...s.foundStores, e.store] }));
          break;
        case 'complete': {
          // A forced live re-discovery rebuilds the result from seeds and would
          // silently drop user-added stores. Re-merge any added store still in
          // the persisted selection so it is never dropped without notice.
          const selectedIds =
            usePreferencesStore.getState().preferences?.selectedStoreIds ?? [];
          const merged = mergeAddedStores(e.result, selectedIds);
          set({
            status: 'success',
            result: merged,
            foundStores: merged.stores,
            progress: 1,
          });
          if (merged !== e.result) {
            void persistence.saveDiscoveryCache(merged);
          }
          break;
        }
        case 'failed':
          set({
            status: 'failed',
            error: { reason: e.reason, message: e.message },
            progress: 1,
          });
          break;
      }
    };

    try {
      const result = await discoveryAgent.discover(postalCode, {
        forceRefresh: opts?.forceRefresh,
        onEvent,
      });
      // A forced live re-discovery / cache expiry rebuilds deals from seeds. The
      // 'complete' handler above already re-merged added stores; now re-apply the
      // flyer overlay on top so user uploads are NEVER silently dropped.
      const current = get().result;
      if (current && get().status === 'success') {
        const overlay = await persistence.getFlyerOverlay(current.postalCode);
        if (overlay && Object.keys(overlay.entries).length > 0) {
          const withOverlay = applyOverlay(current, overlay);
          set({ result: withOverlay, foundStores: withOverlay.stores });
          await persistence.saveDiscoveryCache(withOverlay);
        }
      }
      return result;
    } catch (err) {
      if (err instanceof DiscoveryError) {
        // state already set to failed via the 'failed' event
        return null;
      }
      set({
        status: 'failed',
        error: {
          reason: 'error',
          message: 'Something went wrong while searching for flyers.',
        },
      });
      return null;
    }
  },

  addStore: async (chain) => {
    const result = get().result;
    if (!result) return;
    const fsa = fsaOf(result.postalCode);
    const id = addedStoreIdFor(chain, fsa);
    // Idempotent: never double-add the same deterministic store.
    if (result.stores.some((s) => s.id === id)) return;
    // Chain-level dedupe: a live discovery result already carries one store per
    // chain (e.g. `metro-h4a`). Don't let a user add a seeded duplicate of a
    // chain that's already present, which would double-count its deals.
    if (result.stores.some((s) => s.chain === chain)) return;

    const { store, deals } = makeAddedStore(chain, fsa);
    const updated: DiscoveryResult = {
      ...result,
      stores: [...result.stores, store],
      deals: [...result.deals, ...deals],
    };
    set({ result: updated, foundStores: updated.stores });
    await persistence.saveDiscoveryCache(updated);
  },

  addStoreAndSelect: async (chain) => {
    const before = get().result;
    if (!before) return;
    const id = addedStoreIdFor(chain, fsaOf(before.postalCode));
    // addStore is idempotent and also chain-dedupes, so it may legitimately
    // not add anything (e.g. a live-discovery store of this chain is present).
    await get().addStore(chain);
    // Only select a store that actually landed in the result — never persist a
    // selection for a store id that isn't present (would be an orphan id).
    const after = get().result;
    if (!after || !after.stores.some((s) => s.id === id)) return;
    // Persisting the id into selectedStoreIds is CRITICAL: PricingResolver only
    // considers deals from selected stores, and mergeAddedStores only re-merges
    // still-selected added stores after a re-discovery. Idempotent on the id.
    const prefsStore = usePreferencesStore.getState();
    const selected = prefsStore.preferences?.selectedStoreIds ?? [];
    if (selected.includes(id)) return;
    await prefsStore.update({ selectedStoreIds: [...selected, id] });
  },

  applyExtraction: async (storeId, fileName, deals) => {
    const result = get().result;
    if (!result) return;
    const updated = applyExtractedDeals(result, storeId, deals);
    set({ result: updated, foundStores: updated.stores });
    await persistence.saveDiscoveryCache(updated);
    // Persist the overlay so this upload survives forced re-discovery / expiry.
    await syncOverlayEntry(updated, storeId, fileName);
  },

  editDeal: async (dealId, patch) => {
    const result = get().result;
    if (!result) return;
    const updated = updateDealInResult(result, dealId, patch);
    if (updated === result) return;
    set({ result: updated, foundStores: updated.stores });
    await persistence.saveDiscoveryCache(updated);
    const deal = updated.deals.find((d) => d.id === dealId);
    if (deal) await syncOverlayEntry(updated, deal.storeId);
  },

  removeDeal: async (dealId) => {
    const result = get().result;
    if (!result) return;
    const storeId = result.deals.find((d) => d.id === dealId)?.storeId;
    const updated = removeDealFromResult(result, dealId);
    if (updated === result) return;
    set({ result: updated, foundStores: updated.stores });
    await persistence.saveDiscoveryCache(updated);
    if (storeId) await syncOverlayEntry(updated, storeId);
  },

  reset: () =>
    set({
      status: 'idle',
      progress: 0,
      foundStores: [],
      result: null,
      error: undefined,
      phase: undefined,
      message: undefined,
    }),
}));
