import type {
  DiscoveryResult,
  MealPlan,
  PersistenceAdapter,
  PlanPreferences,
} from '@/domain/types';
import { fsaOf } from '@/domain/postal';
import { kv } from './storage';

/**
 * Discovery-cache schema version. Bump whenever the shape or units of cached
 * deals change so stale entries can never mix with new code. v2 introduced
 * flyer-unit (per-lb) meat deals + sourceUrl/flyerUrl; a v1 cache would hand the
 * new resolver old per-kg-as-lb prices, so it must not be read back.
 */
const DISCOVERY_CACHE_VERSION = 'v2';

const KEYS = {
  preferences: 'ftt:preferences',
  plan: 'ftt:plan:current',
  discovery: (fsa: string) => `ftt:discovery:${DISCOVERY_CACHE_VERSION}:${fsa}`,
  checklist: (planId: string) => `ftt:checklist:${planId}`,
};

/**
 * localStorage/AsyncStorage-backed persistence. Conforms to PersistenceAdapter
 * so a Supabase-backed adapter can be swapped in later without touching state
 * or UI. Discovery cache is keyed by FSA (postal-code prefix) since seeded
 * flyer data is shared across a sortation area.
 */
export class LocalPersistenceAdapter implements PersistenceAdapter {
  getPreferences(): Promise<PlanPreferences | null> {
    return kv.getJSON<PlanPreferences>(KEYS.preferences);
  }

  savePreferences(p: PlanPreferences): Promise<void> {
    return kv.setJSON(KEYS.preferences, p);
  }

  getDiscoveryCache(postal: string): Promise<DiscoveryResult | null> {
    return kv.getJSON<DiscoveryResult>(KEYS.discovery(fsaOf(postal)));
  }

  saveDiscoveryCache(r: DiscoveryResult): Promise<void> {
    return kv.setJSON(KEYS.discovery(fsaOf(r.postalCode)), r);
  }

  getCurrentPlan(): Promise<MealPlan | null> {
    return kv.getJSON<MealPlan>(KEYS.plan);
  }

  saveCurrentPlan(p: MealPlan): Promise<void> {
    return kv.setJSON(KEYS.plan, p);
  }

  async getChecklist(planId: string): Promise<Record<string, boolean>> {
    return (await kv.getJSON<Record<string, boolean>>(KEYS.checklist(planId))) ?? {};
  }

  saveChecklist(planId: string, s: Record<string, boolean>): Promise<void> {
    return kv.setJSON(KEYS.checklist(planId), s);
  }
}

export const persistence: PersistenceAdapter = new LocalPersistenceAdapter();
