import { useEffect, useState } from 'react';
import { usePreferencesStore } from './preferencesStore';
import { usePlanStore } from './planStore';
import { useDiscoveryStore } from './discoveryStore';

/**
 * Hydrates all persisted state on app start: preferences, the current plan and
 * its checklist, and any cached discovery result for the saved postal code.
 * Returns whether hydration has completed so the UI can gate its first render.
 */
export function useBootstrap(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      await usePreferencesStore.getState().hydrate();
      const prefs = usePreferencesStore.getState().preferences;
      if (prefs?.postalCode) {
        await useDiscoveryStore.getState().hydrateFor(prefs.postalCode);
      }
      await usePlanStore.getState().hydrate();
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  return ready;
}

/** Onboarding is complete once we have preferences with a postal + stores. */
export function hasCompletedOnboarding(): boolean {
  const prefs = usePreferencesStore.getState().preferences;
  return !!prefs && !!prefs.postalCode && prefs.selectedStoreIds.length > 0;
}
