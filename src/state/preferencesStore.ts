import { create } from 'zustand';
import type { PlanPreferences } from '@/domain/types';
import { persistence } from '@/services/LocalPersistenceAdapter';

export function defaultPreferences(
  postalCode: string,
  selectedStoreIds: string[],
): PlanPreferences {
  return {
    postalCode,
    selectedStoreIds,
    householdSize: 4,
    dietaryRestrictions: [],
    maxCookTimeMinutes: 30,
    leftoversForLunch: true,
    weeklyBudgetTarget: 120,
    dinnersPerWeek: 7,
  };
}

interface PreferencesState {
  preferences: PlanPreferences | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Replace the whole preferences object (used after onboarding). */
  setPreferences: (p: PlanPreferences) => Promise<void>;
  /** Patch and persist. */
  update: (patch: Partial<PlanPreferences>) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  preferences: null,
  hydrated: false,

  hydrate: async () => {
    const preferences = await persistence.getPreferences();
    set({ preferences, hydrated: true });
  },

  setPreferences: async (p) => {
    set({ preferences: p });
    await persistence.savePreferences(p);
  },

  update: async (patch) => {
    const current = get().preferences;
    if (!current) return;
    const next = { ...current, ...patch };
    set({ preferences: next });
    await persistence.savePreferences(next);
  },
}));
