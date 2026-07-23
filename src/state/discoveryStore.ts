import { create } from 'zustand';
import type {
  DiscoveryEvent,
  DiscoveryPhase,
  DiscoveryResult,
  Store,
} from '@/domain/types';
import { discoveryAgent } from '@/services/MockDiscoveryAgent';
import { DiscoveryError } from '@/services/MockDiscoveryAgent';

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
  reset: () => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set) => ({
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
        case 'complete':
          set({
            status: 'success',
            result: e.result,
            foundStores: e.result.stores,
            progress: 1,
          });
          break;
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
