import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { DietaryTag, MaxCookTime, PlanPreferences } from '@/domain/types';
import { DIETARY_TAGS, DIETARY_LABELS } from '@/domain/types';
import { colors, fontSizes, fontWeights, spacing } from '@/theme/tokens';
import { Button, Chip, SegmentedSlider, Stepper, Toggle } from '@/ui/primitives';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { usePreferencesStore, defaultPreferences } from '@/state/preferencesStore';
import { usePlanStore } from '@/state/planStore';

const COOK_TIME_OPTIONS: { label: string; value: MaxCookTime }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60+ min', value: null },
];

export default function OnboardingPreferences() {
  const router = useRouter();
  const existing = usePreferencesStore((s) => s.preferences);
  const setPreferences = usePreferencesStore((s) => s.setPreferences);
  const generate = usePlanStore((s) => s.generate);

  const [draft, setDraft] = useState<PlanPreferences>(
    existing ?? defaultPreferences('', []),
  );
  const [busy, setBusy] = useState(false);

  const toggleDiet = (tag: DietaryTag) =>
    setDraft((d) => ({
      ...d,
      dietaryRestrictions: d.dietaryRestrictions.includes(tag)
        ? d.dietaryRestrictions.filter((t) => t !== tag)
        : [...d.dietaryRestrictions, tag],
    }));

  const onGenerate = async () => {
    setBusy(true);
    await setPreferences(draft);
    await generate();
    setBusy(false);
    router.replace('/home');
  };

  return (
    <OnboardingScaffold step={4} wide>
      <View style={styles.head}>
        <Text style={styles.heading}>Customize Your Plan</Text>
        <Text style={styles.sub}>Tell us about your household so meals fit.</Text>
      </View>

      <Section title="Household size">
        <Stepper
          value={draft.householdSize}
          min={1}
          max={12}
          suffix="people"
          onChange={(householdSize) => setDraft({ ...draft, householdSize })}
        />
      </Section>

      <Section title="Dietary restrictions" hint="Select all that apply">
        <View style={styles.chips}>
          {DIETARY_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={DIETARY_LABELS[tag]}
              selected={draft.dietaryRestrictions.includes(tag)}
              onPress={() => toggleDiet(tag)}
            />
          ))}
        </View>
      </Section>

      <Section title="Max cook time per meal">
        <SegmentedSlider
          options={COOK_TIME_OPTIONS}
          value={draft.maxCookTimeMinutes}
          onChange={(maxCookTimeMinutes) => setDraft({ ...draft, maxCookTimeMinutes })}
        />
      </Section>

      <Section title="Dinners per week">
        <SegmentedSlider
          options={[
            { label: '5', value: 5 as const },
            { label: '6', value: 6 as const },
            { label: '7', value: 7 as const },
          ]}
          value={draft.dinnersPerWeek}
          onChange={(dinnersPerWeek) => setDraft({ ...draft, dinnersPerWeek })}
        />
      </Section>

      <Section title="Include leftovers for lunch">
        <View style={styles.toggleRow}>
          <Text style={styles.toggleHint}>Cook extra so the plan covers next-day lunches.</Text>
          <Toggle
            value={draft.leftoversForLunch}
            onChange={(leftoversForLunch) => setDraft({ ...draft, leftoversForLunch })}
          />
        </View>
      </Section>

      <Button label="Generate my meal plan" icon="sparkles" onPress={onGenerate} loading={busy} fullWidth />
    </OnboardingScaffold>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      <View style={{ marginTop: spacing.sm }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs, alignItems: 'center' },
  heading: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.text },
  sub: { fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center' },
  section: { gap: spacing.xs },
  sectionTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.text },
  sectionHint: { fontSize: fontSizes.sm, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  toggleHint: { flex: 1, fontSize: fontSizes.sm, color: colors.textMuted },
});
