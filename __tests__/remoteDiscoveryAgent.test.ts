import type {
  Deal,
  DiscoveryEvent,
  DiscoveryResult,
  FlyerOverlay,
  MealPlan,
  PersistenceAdapter,
  PlanPreferences,
  Store,
} from '@/domain/types';
import { RemoteDiscoveryAgent } from '@/services/RemoteDiscoveryAgent';
import { DiscoveryError } from '@/services/discoveryError';

const URL_BASE = 'https://project.supabase.co';
const ANON = 'anon-key';
const FN_PATH = '/functions/v1/discover-deals';

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

const STORE: Store = {
  id: 'metro-h4a',
  chain: 'metro',
  name: 'Metro H4A',
  distanceKm: 0.8,
  dealCount: 1,
  flyerUrl: 'https://www.metro.ca/en/flyer',
};

const DEAL: Deal = {
  id: 'disc-metro-h4a-chicken_thigh',
  storeId: 'metro-h4a',
  ingredientId: 'chicken_thigh',
  label: 'Chicken Thighs',
  labelFr: 'Cuisses de poulet',
  salePrice: 1.99,
  regularPrice: 3.99,
  unit: 'lb',
  validFrom: '2026-07-23',
  validTo: '2026-07-29',
  provenance: 'discovered',
};

const SERVER_BODY = {
  postalCode: 'H4A 1A1',
  stores: [STORE],
  deals: [DEAL],
  fetchedAt: '2026-07-23T12:00:00.000Z',
};

interface PostOutcome {
  status?: number;
  body?: unknown;
  throwNetwork?: boolean;
}

function makeFetch(post: PostOutcome) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (post.throwNetwork) throw new Error('network down');
    const status = post.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => post.body ?? {},
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function makeAgent(post: PostOutcome, persist = new MemoryPersistence()) {
  const { fetchImpl, calls } = makeFetch(post);
  const agent = new RemoteDiscoveryAgent({
    url: URL_BASE,
    anonKey: ANON,
    fetchImpl,
    persist,
    now: () => Date.parse('2026-07-23T12:00:00.000Z'),
  });
  return { agent, calls, persist };
}

describe('RemoteDiscoveryAgent', () => {
  it('maps a successful response to stores + deals and persists it', async () => {
    const { agent, persist } = makeAgent({ status: 200, body: SERVER_BODY });
    const events: DiscoveryEvent[] = [];
    const result = await agent.discover('H4A 1A1', {
      onEvent: (e) => events.push(e),
    });

    expect(result.source).toBe('live');
    expect(result.stores).toEqual([STORE]);
    expect(result.deals).toEqual([DEAL]);
    expect(result.fetchedAt).toBe(SERVER_BODY.fetchedAt);

    // store_found events precede complete; complete is last.
    const storeFoundIdx = events.findIndex((e) => e.type === 'store_found');
    const completeIdx = events.findIndex((e) => e.type === 'complete');
    expect(storeFoundIdx).toBeGreaterThanOrEqual(0);
    expect(completeIdx).toBe(events.length - 1);
    expect(storeFoundIdx).toBeLessThan(completeIdx);

    // Progress across status events is monotonic and ends at 1.
    const progresses = events
      .filter((e): e is Extract<DiscoveryEvent, { type: 'status' }> => e.type === 'status')
      .map((e) => e.progress);
    for (let i = 1; i < progresses.length; i += 1) {
      expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1]);
    }
    expect(progresses[progresses.length - 1]).toBe(1);

    // Persisted to the local cache.
    expect((await persist.getDiscoveryCache('H4A 1A1'))?.deals).toEqual([DEAL]);
  });

  it('sends auth headers and posts to the edge function URL', async () => {
    const { fetchImpl } = makeFetch({ status: 200, body: SERVER_BODY });
    const spy = jest.fn(fetchImpl);
    const agent = new RemoteDiscoveryAgent({
      url: URL_BASE,
      anonKey: ANON,
      fetchImpl: spy as unknown as typeof fetch,
      persist: new MemoryPersistence(),
    });
    await agent.discover('H4A 1A1');

    const [postUrl, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(postUrl).toBe(`${URL_BASE}${FN_PATH}`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${ANON}`,
    );
    expect((init.headers as Record<string, string>).apikey).toBe(ANON);
    expect(JSON.parse(String(init.body)).postalCode).toBe('H4A 1A1');
  });

  it('serves a fresh local cache without hitting the network', async () => {
    const persist = new MemoryPersistence();
    persist.discovery.set('H4A', {
      postalCode: 'H4A 1A1',
      stores: [STORE],
      deals: [DEAL],
      fetchedAt: '2026-07-23T00:00:00.000Z',
      source: 'live',
    });
    const { agent, calls } = makeAgent({ status: 200, body: SERVER_BODY }, persist);

    const result = await agent.discover('H4A 1A1');
    expect(result.source).toBe('cache');
    expect(calls).toHaveLength(0);
  });

  it('stamps the CURRENT postal on a same-FSA cache hit (never the original requester’s)', async () => {
    const persist = new MemoryPersistence();
    persist.discovery.set('H4A', {
      postalCode: 'H4A 1A1',
      stores: [STORE],
      deals: [DEAL],
      fetchedAt: '2026-07-23T00:00:00.000Z',
      source: 'live',
    });
    const { agent, calls } = makeAgent({ status: 200, body: SERVER_BODY }, persist);

    const result = await agent.discover('H4A 2B2');
    expect(result.source).toBe('cache');
    expect(result.postalCode).toBe('H4A 2B2');
    expect(calls).toHaveLength(0);
  });

  it('forceRefresh bypasses a fresh local cache and hits the network', async () => {
    const persist = new MemoryPersistence();
    persist.discovery.set('H4A', {
      postalCode: 'H4A 1A1',
      stores: [STORE],
      deals: [DEAL],
      fetchedAt: '2026-07-23T00:00:00.000Z',
      source: 'live',
    });
    const { agent, calls } = makeAgent({ status: 200, body: SERVER_BODY }, persist);

    const result = await agent.discover('H4A 1A1', { forceRefresh: true });
    expect(result.source).toBe('live');
    expect(calls.some((u) => u.includes(FN_PATH))).toBe(true);
  });

  it('422 no_flyers_found → emits failed THEN throws DiscoveryError', async () => {
    const { agent } = makeAgent({
      status: 422,
      body: { error: 'no_flyers_found' },
    });
    const events: DiscoveryEvent[] = [];
    const err = await agent
      .discover('R3T 2N2', { onEvent: (e) => events.push(e) })
      .catch((e) => e);

    expect(err).toBeInstanceOf(DiscoveryError);
    expect(err.reason).toBe('no_flyers_found');
    const failed = events.find((e) => e.type === 'failed');
    expect(failed && failed.type === 'failed' && failed.reason).toBe(
      'no_flyers_found',
    );
    // failed is emitted (loud) before the throw — it's the last event seen.
    expect(events[events.length - 1].type).toBe('failed');
  });

  it('500 → generic error DiscoveryError', async () => {
    const { agent } = makeAgent({ status: 500, body: { error: 'error' } });
    const err = await agent.discover('H4A 1A1').catch((e) => e);
    expect(err).toBeInstanceOf(DiscoveryError);
    expect(err.reason).toBe('error');
  });

  it('network throw → generic error DiscoveryError', async () => {
    const { agent } = makeAgent({ throwNetwork: true });
    const err = await agent.discover('H4A 1A1').catch((e) => e);
    expect(err).toBeInstanceOf(DiscoveryError);
    expect(err.reason).toBe('error');
  });

  it('never resolves an empty result (empty stores+deals → no_flyers_found)', async () => {
    const { agent } = makeAgent({
      status: 200,
      body: { postalCode: 'H4A 1A1', stores: [], deals: [] },
    });
    const err = await agent.discover('H4A 1A1').catch((e) => e);
    expect(err).toBeInstanceOf(DiscoveryError);
    expect(err.reason).toBe('no_flyers_found');
  });
});
