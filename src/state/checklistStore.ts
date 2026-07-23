import { create } from 'zustand';
import { persistence } from '@/services/LocalPersistenceAdapter';

interface ChecklistState {
  planId: string | null;
  checked: Record<string, boolean>;
  hydrateFor: (planId: string) => Promise<void>;
  toggle: (key: string) => Promise<void>;
  reset: (planId: string) => Promise<void>;
  isChecked: (key: string) => boolean;
}

export const useChecklistStore = create<ChecklistState>((set, get) => ({
  planId: null,
  checked: {},

  hydrateFor: async (planId) => {
    if (get().planId === planId && Object.keys(get().checked).length > 0) return;
    const checked = await persistence.getChecklist(planId);
    set({ planId, checked });
  },

  toggle: async (key) => {
    const { planId, checked } = get();
    const next = { ...checked, [key]: !checked[key] };
    set({ checked: next });
    if (planId) await persistence.saveChecklist(planId, next);
  },

  reset: async (planId) => {
    set({ planId, checked: {} });
    await persistence.saveChecklist(planId, {});
  },

  isChecked: (key) => !!get().checked[key],
}));
