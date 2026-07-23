import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DietaryTag, MaxCookTime, PlanPreferences } from '@/domain/types';
import { DIETARY_TAGS, DIETARY_LABELS } from '@/domain/types';
import { colors, fontSizes, fontWeights, spacing } from '@/theme/tokens';
import { Button, Chip, SegmentedSlider, Stepper, Toggle, Field } from '@/ui/primitives';
import { Drawer } from '@/ui/Overlay';
import { usePreferencesStore } from '@/state/preferencesStore';
import { usePlanStore } from '@/state/planStore';

const COOK_TIME_OPTIONS: { label: string; value: MaxCookTime }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60+ min', value: null },
];

export function PreferencesDrawer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const preferences = usePreferencesStore((s) => s.preferences);
  const setPreferences = usePreferencesStore((s) => s.setPreferences);
  const generate = usePlanStore((s) => s.generate);
  const [draft, setDraft] = useState<PlanPreferences | null>(preferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setDraft(preferences);
  }, [visible, preferences]);

  if (!draft) return null;

  const toggleDiet = (tag: DietaryTag) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            dietaryRestrictions: d.dietaryRestrictions.includes(tag)
              ? d.dietaryRestrictions.filter((t) => t !== tag)
              : [...d.dietaryRestrictions, tag],
          }
        : d,
    );
  };

  const onRegenerate = async () => {
    setSaving(true);
    await setPreferences(draft);
    await generate();
    setSaving(false);
    onClose();
  };

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      title="Adjust your weekly plan"
      subtitle="Set preferences to personalize your meals"
      footer={
        <>
          <View style={{ flex: 1 }}>
            <Button label="Regenerate plan" onPress={onRegenerate} loading={saving} fullWidth />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Cancel" variant="secondary" onPress={onClose} fullWidth />
          </View>
        </>
      }
    >
      <Section title="Household size">
        <Stepper
          value={draft.householdSize}
          min={1}
          max={12}
          suffix="people"
          onChange={(householdSize) => setDraft({ ...draft, householdSize })}
        />
      </Section>

      <Section title="Dietary restrictions" hint="Select all that apply to your household">
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
          <Text style={styles.toggleHint}>
            Repeats dinner portions the next day so the plan covers lunches too.
          </Text>
          <Toggle
            value={draft.leftoversForLunch}
            onChange={(leftoversForLunch) => setDraft({ ...draft, leftoversForLunch })}
          />
        </View>
      </Section>

      <Section title="Weekly budget target" hint="Guidance only — never limits your plan">
        <Field
          keyboardType="numeric"
          value={draft.weeklyBudgetTarget ? String(draft.weeklyBudgetTarget) : ''}
          placeholder="120"
          onChangeText={(t) => {
            const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
            setDraft({ ...draft, weeklyBudgetTarget: Number.isNaN(n) ? undefined : n });
          }}
        />
      </Section>
    </Drawer>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      <View style={{ marginTop: spacing.sm }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  sectionTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.text },
  sectionHint: { fontSize: fontSizes.sm, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  toggleHint: { flex: 1, fontSize: fontSizes.sm, color: colors.textMuted },
});
