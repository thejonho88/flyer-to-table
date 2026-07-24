import type {
  Deal,
  DiscoverOptions,
  DiscoveryAgent,
  DiscoveryEvent,
  DiscoveryPhase,
  DiscoveryResult,
  PersistenceAdapter,
  Store,
} from '@/domain/types';
import { persistence as defaultPersistence } from './LocalPersistenceAdapter';
import { DiscoveryError } from './discoveryError';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Server-side pipeline (Flipp fan-out + Claude matching) can be slow. */
const REQUEST_TIMEOUT_MS = 180_000;

/** How often the synthetic progress ticker advances while awaiting the server. */
const TICK_INTERVAL_MS = 900;

type FetchImpl = typeof fetch;

/** Synthetic progress phases: monotonic bands the ticker walks through. */
const PHASES: Array<{ phase: DiscoveryPhase; end: number; message: string }> = [
  { phase: 'searching_stores', end: 0.3, message: 'Searching for grocery stores near {p}…' },
  { phase: 'fetching_flyers', end: 0.6, message: 'Fetching this week’s circulaires…' },
  { phase: 'extracting_deals', end: 0.9, message: 'Matching deals to ingredients…' },
];

export interface RemoteDiscoveryAgentOptions {
  /** Supabase project URL, e.g. https://xxxx.supabase.co (trailing slash ok). */
  url: string;
  /** Public anon key (sent as both Authorization bearer and apikey). */
  anonKey: string;
  /** Injectable fetch for tests; defaults to the global. */
  fetchImpl?: FetchImpl;
  /** Persistence for the 7-day local cache; defaults to the shared adapter. */
  persist?: PersistenceAdapter;
  /** Injectable clock for tests. */
  now?: () => number;
}

interface EdgeResponse {
  postalCode?: string;
  stores?: Store[];
  deals?: Deal[];
  fetchedAt?: string;
}

/**
 * Live discovery agent: fans out to the discover-deals edge function which hits
 * Flipp + Claude server-side and returns synthesized stores + discovered deals.
 *
 * Mirrors MockDiscoveryAgent's contract: serves a fresh 7-day local cache,
 * streams visible progress, emits `store_found` per store then `complete`, and —
 * critically — fails LOUDLY (emit `failed` THEN throw DiscoveryError) rather than
 * ever resolving an empty/partial result.
 */
export class RemoteDiscoveryAgent implements DiscoveryAgent {
  private readonly url: string;
  private readonly anonKey: string;
  private readonly fetchImpl: FetchImpl;
  private readonly persist: PersistenceAdapter;
  private readonly now: () => number;

  constructor(opts: RemoteDiscoveryAgentOptions) {
    this.url = opts.url.replace(/\/+$/, '');
    this.anonKey = opts.anonKey;
    // Bind global fetch: calling it unbound throws "Illegal invocation" on web.
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
    this.persist = opts.persist ?? defaultPersistence;
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

    // 1) Serve a fresh local cache unless a manual refresh was requested.
    if (!forceRefresh) {
      const cached = await this.persist.getDiscoveryCache(postalCode);
      if (cached && this.isFresh(cached)) {
        // The cache is FSA-keyed; stamp the CURRENT request's postal code so a
        // same-area neighbour never sees the original requester's postal.
        const result: DiscoveryResult = { ...cached, postalCode, source: 'cache' };
        emit({ type: 'complete', result });
        return result;
      }
    }

    // 2) Live run: kick off visible progress and a synthetic monotonic ticker.
    emit({
      type: 'status',
      phase: 'searching_stores',
      message: `Searching for grocery stores near ${postalCode}…`,
      progress: 0.1,
    });

    let progress = 0.1;
    let phaseIdx = 0;
    const ticker = setInterval(() => {
      const band = PHASES[phaseIdx];
      progress = Math.min(band.end, progress + 0.04);
      if (progress >= band.end && phaseIdx < PHASES.length - 1) {
        phaseIdx += 1;
      }
      const active = PHASES[phaseIdx];
      emit({
        type: 'status',
        phase: active.phase,
        message: active.message.replace('{p}', postalCode),
        progress,
      });
    }, TICK_INTERVAL_MS);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      try {
        res = await this.fetchImpl(`${this.url}/functions/v1/discover-deals`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.anonKey}`,
            apikey: this.anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ postalCode, forceRefresh }),
          signal: controller.signal,
        });
      } finally {
        clearInterval(ticker);
        clearTimeout(timeout);
      }
    } catch {
      return this.fail(emit, 'error', postalCode);
    }

    if (!res.ok) {
      const reason = await this.readErrorReason(res);
      return this.fail(emit, reason, postalCode);
    }

    let body: EdgeResponse;
    try {
      body = (await res.json()) as EdgeResponse;
    } catch {
      return this.fail(emit, 'error', postalCode);
    }

    const stores = Array.isArray(body.stores) ? body.stores : [];
    const deals = Array.isArray(body.deals) ? body.deals : [];
    // Never resolve with an empty result — that would be a silent failure.
    if (stores.length === 0 && deals.length === 0) {
      return this.fail(emit, 'no_flyers_found', postalCode);
    }

    // Finish the progress bar, then reveal stores one at a time so the UI
    // accumulates them like the mock does during its live loop.
    emit({
      type: 'status',
      phase: 'extracting_deals',
      message: 'Finalizing deals…',
      progress: 1,
    });
    for (const store of stores) {
      emit({ type: 'store_found', store });
    }

    const result: DiscoveryResult = {
      postalCode,
      stores,
      deals,
      fetchedAt:
        typeof body.fetchedAt === 'string'
          ? body.fetchedAt
          : new Date(this.now()).toISOString(),
      source: 'live',
    };

    await this.persist.saveDiscoveryCache(result);
    emit({ type: 'complete', result });
    return result;
  }

  /** Emit the loud `failed` event THEN throw — matching the mock exactly. */
  private fail(
    emit: (e: DiscoveryEvent) => void,
    reason: 'no_flyers_found' | 'error',
    postalCode: string,
  ): never {
    emit({
      type: 'failed',
      reason,
      message:
        reason === 'no_flyers_found'
          ? `No local flyers found for ${postalCode}. We couldn't find circulaire data for this area right now.`
          : 'Something went wrong while searching for flyers.',
    });
    throw new DiscoveryError(reason, postalCode);
  }

  /** Map a non-2xx response to a known failure reason (defaults to 'error'). */
  private async readErrorReason(
    res: Response,
  ): Promise<'no_flyers_found' | 'error'> {
    try {
      const body = (await res.json()) as { error?: unknown };
      if (body?.error === 'no_flyers_found') return 'no_flyers_found';
    } catch {
      // fall through
    }
    return 'error';
  }
}
