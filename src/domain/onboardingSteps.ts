/**
 * Pure reachability logic for onboarding step navigation. No React, no zustand,
 * no I/O — the scaffold reads the stores and feeds a plain snapshot in here.
 *
 * Steps:  postal = 0, discovery = 1, stores = 2, prefs = 3.
 *
 * Rules (each deliberately conservative — never unlock a step on stale data):
 *  - Step 0 (postal) is always reachable.
 *  - Step 1 (discovery) is NEVER a navigation target. It is a transient,
 *    auto-advancing screen; back from step 2 lands on step 0 and the arrows
 *    skip over it.
 *  - Step 2 (stores) is reachable iff a discovery result exists AND its postal
 *    FSA matches the current prefs postal FSA (a result left over from an old
 *    postal code must NOT unlock store selection).
 *  - Step 3 (prefs) is reachable iff step 2's condition holds AND the persisted
 *    prefs already carry at least one selected store (the stores screen keeps
 *    its selection in local state and only persists it on Continue — so we gate
 *    on the persisted value, not transient UI state).
 */
import type { DiscoveryResult, PlanPreferences } from './types';
import { fsaOf } from './postal';

export const ONBOARDING_STEP = {
  postal: 0,
  discovery: 1,
  stores: 2,
  prefs: 3,
} as const;

export const ONBOARDING_STEP_COUNT = 4;

/** Discovery (step 1) is auto-advancing and never a manual nav target. */
export const DISCOVERY_STEP = ONBOARDING_STEP.discovery;

/** Route per navigable step. Discovery is intentionally absent. */
export const ONBOARDING_STEP_ROUTE: Record<number, string> = {
  [ONBOARDING_STEP.postal]: '/onboarding/postal',
  [ONBOARDING_STEP.stores]: '/onboarding/stores',
  [ONBOARDING_STEP.prefs]: '/onboarding/preferences',
};

export interface OnboardingReachabilityInput {
  result: DiscoveryResult | null;
  prefs: PlanPreferences | null;
}

function storesReachable({ result, prefs }: OnboardingReachabilityInput): boolean {
  if (!result || !prefs) return false;
  return fsaOf(result.postalCode) === fsaOf(prefs.postalCode);
}

/** Whether `step` can currently be navigated to. */
export function isStepReachable(
  step: number,
  input: OnboardingReachabilityInput,
): boolean {
  switch (step) {
    case ONBOARDING_STEP.postal:
      return true;
    case ONBOARDING_STEP.discovery:
      return false; // never a nav target
    case ONBOARDING_STEP.stores:
      return storesReachable(input);
    case ONBOARDING_STEP.prefs:
      return (
        storesReachable(input) &&
        (input.prefs?.selectedStoreIds.length ?? 0) > 0
      );
    default:
      return false;
  }
}

/** All navigable step indices, ascending. */
export function reachableSteps(input: OnboardingReachabilityInput): number[] {
  const steps: number[] = [];
  for (let i = 0; i < ONBOARDING_STEP_COUNT; i++) {
    if (isStepReachable(i, input)) steps.push(i);
  }
  return steps;
}

/** Next reachable step after `current` (skips discovery), or null at the end. */
export function nextReachableStep(
  current: number,
  input: OnboardingReachabilityInput,
): number | null {
  for (let i = current + 1; i < ONBOARDING_STEP_COUNT; i++) {
    if (isStepReachable(i, input)) return i;
  }
  return null;
}

/** Previous reachable step before `current` (skips discovery), or null at the start. */
export function prevReachableStep(
  current: number,
  input: OnboardingReachabilityInput,
): number | null {
  for (let i = current - 1; i >= 0; i--) {
    if (isStepReachable(i, input)) return i;
  }
  return null;
}
