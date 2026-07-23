import type { PlanPreferences } from './types';

export type RecoveryRoute = '/onboarding/discovery' | '/onboarding/postal';

/**
 * Where to send the user when plan generation can't proceed because there is no
 * discovery context (e.g. the discovery cache was invalidated by a schema-version
 * bump, or expired after 7 days), yet a stale persisted plan is still on screen.
 *
 * If we still know their postal code, re-run discovery via its visible progress
 * screen (then stores → preferences → regenerate as normal); otherwise start
 * over at postal entry. Either way the "Generate" button is never a silent no-op.
 */
export function recoveryRouteFor(prefs: PlanPreferences | null): RecoveryRoute {
  return prefs?.postalCode ? '/onboarding/discovery' : '/onboarding/postal';
}
