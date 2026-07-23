import { create } from 'zustand';
import type {
  Chain,
  DiscoveryEvent,
  DiscoveryPhase,
  DiscoveryResult,
  Store,
} from '@/domain/types';
import { fsaOf } from '@/domain/postal';
import {
  addedStoreIdFor,
  makeAddedStore,
  mergeAddedStores,
} from '@/data/deals';
import { discoveryAgent } from '@/services/MockDiscoveryAgent';
import { DiscoveryError } from '@/services/MockDiscoveryAgent';
import { persistence } from '@/services/LocalPersistenceAdapter';
import { usePreferencesStore } from './preferencesStore';

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
      set({
        status: 'success',
        result: cached,
        foundStores: cached.stores,
        progress: 1,
      });
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

    const { store, deals } = makeAddedStore(chain, fsa);
    const updated: DiscoveryResult = {
      ...result,
      stores: [...result.stores, store],
      deals: [...result.deals, ...deals],
    };
    set({ result: updated, foundStores: updated.stores });
    await persistence.saveDiscoveryCache(updated);
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
