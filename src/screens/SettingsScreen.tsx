import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DIETARY_LABELS } from '@/domain/types';
import { colors, fontSizes, fontWeights, spacing } from '@/theme/tokens';
import { Button, Card } from '@/ui/primitives';
import { usePreferencesStore } from '@/state/preferencesStore';
import { PreferencesDrawer } from '@/components/PreferencesDrawer';

export function SettingsScreen() {
  const router = useRouter();
  const prefs = usePreferencesStore((s) => s.preferences);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const cookTime =
    prefs?.maxCookTimeMinutes == null ? '60+ min' : `${prefs.maxCookTimeMinutes} min`;
  const diets =
    prefs && prefs.dietaryRestrictions.length > 0
      ? prefs.dietaryRestrictions.map((t) => DIETARY_LABELS[t]).join(', ')
      : 'None';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Row label="Postal code" value={prefs?.postalCode ?? '—'} />
        <Row label="Selected stores" value={`${prefs?.selectedStoreIds.length ?? 0} stores`} />
        <Button label="Edit location & stores" variant="secondary" onPress={() => router.push('/onboarding/postal')} />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Plan preferences</Text>
        <Row label="Household size" value={`${prefs?.householdSize ?? 4} people`} />
        <Row label="Dietary restrictions" value={diets} />
        <Row label="Max cook time" value={cookTime} />
        <Row label="Dinners per week" value={`${prefs?.dinnersPerWeek ?? 7}`} />
        <Row label="Leftovers for lunch" value={prefs?.leftoversForLunch ? 'On' : 'Off'} />
        <Row
          label="Weekly budget target"
          value={prefs?.weeklyBudgetTarget ? `$${prefs.weeklyBudgetTarget}` : 'Not set'}
        />
        <Button label="Adjust preferences" onPress={() => setPrefsOpen(true)} />
      </Card>

      <PreferencesDrawer visible={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold, color: colors.text },
  card: { gap: spacing.md },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.text, marginBottom: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  rowLabel: { fontSize: fontSizes.md, color: colors.textMuted },
  rowValue: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.text, flexShrink: 1, textAlign: 'right' },
});
