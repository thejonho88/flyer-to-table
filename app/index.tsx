import React from 'react';
import { Redirect } from 'expo-router';
import { usePreferencesStore } from '@/state/preferencesStore';

/** Entry point: route to the plan if onboarding is done, else to onboarding. */
export default function Index() {
  const prefs = usePreferencesStore((s) => s.preferences);
  const onboarded = !!prefs && !!prefs.postalCode && prefs.selectedStoreIds.length > 0;
  return <Redirect href={onboarded ? '/home' : '/onboarding/postal'} />;
}
