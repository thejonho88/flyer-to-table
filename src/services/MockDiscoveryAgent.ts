import type {
  DiscoverOptions,
  DiscoveryAgent,
  DiscoveryEvent,
  DiscoveryResult,
  PersistenceAdapter,
  Store,
} from '@/domain/types';
import { fsaOf } from '@/domain/postal';
import { getSeededArea } from '@/data/deals';
import { persistence as defaultPersistence } from './LocalPersistenceAdapter';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface MockDiscoveryAgentOptions {
  /** Multiplier on simulated latency. 1 = default; 0 = instant (tests). */
  latencyScale?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

/**
 * Stand-in for the real server-side discovery agent (Phase 0 unvalidated).
 * Streams progress events, simulates per-phase latency, serves a 7-day cache,
 * supports manual refresh, and — critically — fails LOUDLY with
 * `no_flyers_found` for any postal code we have no seeded data for. It never
 * silently returns an empty/partial result.
 *
 * Sits behind the DiscoveryAgent interface so a live implementation can drop
 * in unchanged.
 */
export class MockDiscoveryAgent implements DiscoveryAgent {
  private readonly persist: PersistenceAdapter;
  private readonly latencyScale: number;
  private readonly now: () => number;

  constructor(
    persist: PersistenceAdapter = defaultPersistence,
    opts: MockDiscoveryAgentOptions = {},
  ) {
    this.persist = persist;
    this.latencyScale = opts.latencyScale ?? 1;
    this.now = opts.now ?? (() => Date.now());
  }

  getCached(postalCode: string): Promise<DiscoveryResult | null> {
    return this.persist.getDiscoveryCache(postalCode);
  }

  private isFresh(result: DiscoveryResult): boolean {
    const age = this.now() - new Date(result.fetchedAt).getTime();
    return age >= 0 && age < SEVEN_DAYS_MS;
  }

  async discover(
    postalCode: string,
    opts: DiscoverOptions = {},
  ): Promise<DiscoveryResult> {
    const { forceRefresh = false, onEvent } = opts;
    const emit = (e: DiscoveryEvent) => onEvent?.(e);

    // 1) Serve fresh cache unless a manual refresh was requested.
    if (!forceRefresh) {
      const cached = await this.persist.getDiscoveryCache(postalCode);
      if (cached && this.isFresh(cached)) {
        const result: DiscoveryResult = { ...cached, source: 'cache' };
        emit({ type: 'complete', result });
        return result;
      }
    }

    // 2) Run the live (simulated) discovery loop with visible progress.
    const wait = (ms: number) => delay(ms * this.latencyScale);
    const fsa = fsaOf(postalCode);
    const area = getSeededArea(fsa);

    emit({
      type: 'status',
      phase: 'searching_stores',
      message: `Searching for grocery stores near ${postalCode}…`,
      progress: 0.12,
    });
    await wait(700);

    // Loud failure for unseeded areas — after showing progress, never silently.
    if (!area || area.stores.length === 0) {
      emit({
        type: 'failed',
        reason: 'no_flyers_found',
        message: `No local flyers found for ${postalCode}. We don't have circulaire data for this area yet.`,
      });
      throw new DiscoveryError('no_flyers_found', postalCode);
    }

    // Reveal stores one at a time as the agent "finds" them.
    const found: Store[] = [];
    for (const store of area.stores) {
      await wait(180);
      found.push(store);
      emit({ type: 'store_found', store });
    }

    emit({
      type: 'status',
      phase: 'fetching_flyers',
      message: 'Fetching this week’s circulaires…',
      progress: 0.55,
    });
    await wait(650);

    emit({
      type: 'status',
      phase: 'extracting_deals',
      message: 'Extracting deals from flyers…',
      progress: 0.85,
    });
    await wait(600);

    const result: DiscoveryResult = {
      postalCode,
      stores: area.stores,
      deals: area.deals,
      fetchedAt: new Date(this.now()).toISOString(),
      source: 'live',
    };

    await this.persist.saveDiscoveryCache(result);
    emit({ type: 'complete', result });
    return result;
  }
}

export class DiscoveryError extends Error {
  constructor(
    public reason: 'no_flyers_found' | 'error',
    public postalCode: string,
  ) {
    super(`Discovery failed (${reason}) for ${postalCode}`);
    this.name = 'DiscoveryError';
  }
}

export const discoveryAgent: DiscoveryAgent = new MockDiscoveryAgent();
