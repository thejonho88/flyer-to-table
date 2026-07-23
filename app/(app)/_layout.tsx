import React from 'react';
import { Redirect, Slot } from 'expo-router';
import { usePreferencesStore } from '@/state/preferencesStore';
import { AppShell } from '@/components/AppShell';

export default function AppGroupLayout() {
  const prefs = usePreferencesStore((s) => s.preferences);
  const onboarded = !!prefs && !!prefs.postalCode && prefs.selectedStoreIds.length > 0;

  if (!onboarded) return <Redirect href="/onboarding/postal" />;

  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
