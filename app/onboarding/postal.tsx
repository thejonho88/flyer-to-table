import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSizes, fontWeights, spacing } from '@/theme/tokens';
import { Button, Field } from '@/ui/primitives';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { isValidPostalCode, normalizePostalCode } from '@/domain/postal';
import { usePreferencesStore, defaultPreferences } from '@/state/preferencesStore';
import { useDiscoveryStore } from '@/state/discoveryStore';

export default function PostalScreen() {
  const router = useRouter();
  const existing = usePreferencesStore((s) => s.preferences);
  const setPreferences = usePreferencesStore((s) => s.setPreferences);
  const resetDiscovery = useDiscoveryStore((s) => s.reset);

  const [value, setValue] = useState(existing?.postalCode ?? '');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!isValidPostalCode(value)) {
      setError('Please enter a valid Canadian postal code (e.g. H2X 1Y4).');
      return;
    }
    const postal = normalizePostalCode(value);
    // Preserve any existing selections/prefs on edit; otherwise start fresh.
    const base = existing
      ? { ...existing, postalCode: postal, selectedStoreIds: [] }
      : defaultPreferences(postal, []);
    await setPreferences(base);
    resetDiscovery();
    router.push('/onboarding/discovery');
  };

  return (
    <OnboardingScaffold step={0}>
      <View style={styles.head}>
        <Text style={styles.heading}>Plan meals from local deals</Text>
        <Text style={styles.sub}>
          Enter your postal code and we'll find grocery flyers near you.
        </Text>
      </View>

      <Field
        icon="location-outline"
        placeholder="H2X 1Y4"
        autoCapitalize="characters"
        value={value}
        onChangeText={(t) => {
          setValue(t);
          setError(null);
        }}
        onSubmitEditing={onSubmit}
        returnKeyType="go"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Find local deals" icon="search" onPress={onSubmit} fullWidth />

      <Text style={styles.hint}>
        Pilot market: Montreal — any{' '}
        <Text style={styles.hintStrong}>H</Text> postal code works (e.g.{' '}
        <Text style={styles.hintStrong}>H4A 2Z9</Text>).
      </Text>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs, alignItems: 'center' },
  heading: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.text, textAlign: 'center' },
  sub: { fontSize: fontSizes.md, color: colors.textMuted, textAlign: 'center' },
  error: { color: colors.danger, fontSize: fontSizes.sm },
  hint: { fontSize: fontSizes.sm, color: colors.textFaint, textAlign: 'center' },
  hintStrong: { color: colors.brand, fontWeight: fontWeights.semibold },
});
