import { create } from 'zustand';
import type {
  MealPlan,
  PlanContext,
  ShoppingList,
  SwapAlternative,
} from '@/domain/types';
import { buildPlanContext } from '@/domain/context';
import {
  applySwap,
  generatePlan,
  getSwapAlternatives,
} from '@/domain/planner';
import { buildShoppingList } from '@/domain/shoppingList';
import { persistence } from '@/services/LocalPersistenceAdapter';
import { usePreferencesStore } from './preferencesStore';
import { useDiscoveryStore } from './discoveryStore';
import { useChecklistStore } from './checklistStore';

type PlanStatus = 'idle' | 'generating' | 'ready';

interface PlanState {
  plan: MealPlan | null;
  status: PlanStatus;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  /** Build a PlanContext from current prefs + discovery result. */
  getContext: () => PlanContext | null;
  generate: () => Promise<MealPlan | null>;
  swap: (day: number, recipeId: string) => Promise<void>;
  alternativesFor: (day: number) => SwapAlternative[];
  shoppingList: () => ShoppingList | null;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plan: null,
  status: 'idle',
  hydrated: false,

  hydrate: async () => {
    const plan = await persistence.getCurrentPlan();
    set({ plan, status: plan ? 'ready' : 'idle', hydrated: true });
    if (plan) await useChecklistStore.getState().hydrateFor(plan.id);
  },

  getContext: () => {
    const prefs = usePreferencesStore.getState().preferences;
    const result = useDiscoveryStore.getState().result;
    if (!prefs || !result) return null;
    return buildPlanContext(result, prefs);
  },

  generate: async () => {
    const ctx = get().getContext();
    if (!ctx) return null;
    set({ status: 'generating' });
    const plan = generatePlan(ctx);
    set({ plan, status: 'ready' });
    await persistence.saveCurrentPlan(plan);
    await useChecklistStore.getState().reset(plan.id);
    return plan;
  },

  swap: async (day, recipeId) => {
    const ctx = get().getContext();
    const plan = get().plan;
    if (!ctx || !plan) return;
    const next = applySwap(plan, day, recipeId, ctx);
    set({ plan: next });
    await persistence.saveCurrentPlan(next);
  },

  alternativesFor: (day) => {
    const ctx = get().getContext();
    const plan = get().plan;
    if (!ctx || !plan) return [];
    return getSwapAlternatives(plan, day, ctx);
  },

  shoppingList: () => {
    const ctx = get().getContext();
    const plan = get().plan;
    if (!ctx || !plan) return null;
    return buildShoppingList(plan, ctx);
  },
}));
