import type {
  DiscoveryEvent,
  DiscoveryResult,
  MealPlan,
  PersistenceAdapter,
  PlanPreferences,
} from '@/domain/types';
import { MockDiscoveryAgent, DiscoveryError } from '@/services/MockDiscoveryAgent';

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

describe('MockDiscoveryAgent', () => {
  it('emits visible progress and completes for a seeded area', async () => {
    const persist = new MemoryPersistence();
    const events: DiscoveryEvent[] = [];
    const result = await agent(persist).discover('H2X 1Y4', {
      onEvent: (e) => events.push(e),
    });

    expect(result.source).toBe('live');
    expect(result.stores.length).toBeGreaterThan(0);
    expect(result.deals.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'status')).toBe(true);
    expect(events.some((e) => e.type === 'store_found')).toBe(true);
    expect(events[events.length - 1].type).toBe('complete');
  });

  it('fails LOUDLY (never silently) for an unseeded area', async () => {
    const persist = new MemoryPersistence();
    const events: DiscoveryEvent[] = [];
    await expect(
      agent(persist).discover('R3T 2N2', { onEvent: (e) => events.push(e) }),
    ).rejects.toBeInstanceOf(DiscoveryError);

    // progress was shown before the failure
    expect(events.some((e) => e.type === 'status')).toBe(true);
    const failed = events.find((e) => e.type === 'failed');
    expect(failed).toBeDefined();
    expect(failed && failed.type === 'failed' && failed.reason).toBe(
      'no_flyers_found',
    );
  });

  it('succeeds for any Montreal H postal code (unseeded FSA maps to a seeded area)', async () => {
    const persist = new MemoryPersistence();
    const events: DiscoveryEvent[] = [];
    const result = await agent(persist).discover('H4A 2Z9', {
      onEvent: (e) => events.push(e),
    });

    expect(result.source).toBe('live');
    expect(result.stores.length).toBeGreaterThan(0);
    expect(result.deals.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'store_found')).toBe(true);
    expect(events[events.length - 1].type).toBe('complete');
  });

  it('fails LOUDLY for a non-H (non-Montreal) postal code', async () => {
    const persist = new MemoryPersistence();
    const events: DiscoveryEvent[] = [];
    await expect(
      agent(persist).discover('M5V 2T6', { onEvent: (e) => events.push(e) }),
    ).rejects.toBeInstanceOf(DiscoveryError);

    const failed = events.find((e) => e.type === 'failed');
    expect(failed && failed.type === 'failed' && failed.reason).toBe(
      'no_flyers_found',
    );
  });

  it('produces deterministic per-FSA store distances', async () => {
    // Two independent live discoveries for the same FSA must agree exactly.
    const a = await agent(new MemoryPersistence()).discover('H4A 2Z9');
    const b = await agent(new MemoryPersistence()).discover('H4A 2Z9');
    expect(a.stores.map((s) => s.distanceKm)).toEqual(
      b.stores.map((s) => s.distanceKm),
    );
  });

  it('serves fresh cache without re-running the live loop', async () => {
    const persist = new MemoryPersistence();
    await agent(persist).discover('H2X 1Y4');

    const events: DiscoveryEvent[] = [];
    const cached = await agent(persist).discover('H2X 1Y4', {
      onEvent: (e) => events.push(e),
    });
    expect(cached.source).toBe('cache');
    expect(events.some((e) => e.type === 'store_found')).toBe(false);
  });

  it('re-runs live when cache is stale (>7 days) or on forceRefresh', async () => {
    const persist = new MemoryPersistence();
    const t0 = new Date('2026-07-01T12:00:00Z').getTime();
    await agent(persist, () => t0).discover('H2X 1Y4');

    // 8 days later -> stale -> live again
    const t1 = t0 + 8 * 24 * 60 * 60 * 1000;
    const stale = await agent(persist, () => t1).discover('H2X 1Y4');
    expect(stale.source).toBe('live');

    // fresh cache but forceRefresh -> live
    const forced = await agent(persist, () => t1).discover('H2X 1Y4', {
      forceRefresh: true,
    });
    expect(forced.source).toBe('live');
  });
});
