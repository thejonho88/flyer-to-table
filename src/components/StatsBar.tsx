import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { MealPlan } from '@/domain/types';
import { colors, fontSizes, fontWeights, spacing, NARROW_BREAKPOINT } from '@/theme/tokens';
import { Card, Button } from '@/ui/primitives';
import { formatMoney } from '@/domain/money';

export function StatsBar({
  plan,
  onGenerateList,
}: {
  plan: MealPlan;
  onGenerateList: () => void;
}) {
  const { width } = useWindowDimensions();
  const narrow = width < NARROW_BREAKPOINT;
  const { totals, meals } = plan;

  return (
    <Card style={narrow ? styles.cardNarrow : styles.card}>
      <View style={[styles.stats, narrow && styles.statsNarrow]}>
        <Stat label="Estimated Weekly Cost" value={formatMoney(totals.estimated)} />
        <Divider narrow={narrow} />
        <Stat
          label="Savings vs Regular Price"
          value={formatMoney(totals.savings)}
          accent
          suffix={`${totals.savingsPct}% off`}
        />
        <Divider narrow={narrow} />
        <Stat label="Meals Planned" value={`${meals.length} dinners`} />
      </View>
      <Button label="Generate Shopping List" onPress={onGenerateList} />
    </Card>
  );
}

function Stat({
  label,
  value,
  accent,
  suffix,
}: {
  label: string;
  value: string;
  accent?: boolean;
  suffix?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.statValue, accent && { color: colors.success }]}>{value}</Text>
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function Divider({ narrow }: { narrow: boolean }) {
  if (narrow) return null;
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xl },
  cardNarrow: { gap: spacing.lg },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xl, flexShrink: 1 },
  statsNarrow: { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.md },
  stat: { gap: spacing.xs },
  statLabel: { fontSize: fontSizes.sm, color: colors.textMuted },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  statValue: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold, color: colors.text },
  suffix: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.success },
  divider: { width: 1, height: 44, backgroundColor: colors.border },
});
