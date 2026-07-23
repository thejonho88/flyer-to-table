import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SwapAlternative } from '@/domain/types';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Button, Badge } from '@/ui/primitives';
import { Modal } from '@/ui/Overlay';
import { usePlanStore } from '@/state/planStore';

export function SwapModal({
  day,
  visible,
  onClose,
}: {
  day: number | null;
  visible: boolean;
  onClose: () => void;
}) {
  const alternativesFor = usePlanStore((s) => s.alternativesFor);
  const swap = usePlanStore((s) => s.swap);

  const alternatives: SwapAlternative[] =
    visible && day != null ? alternativesFor(day) : [];

  const onSwapIn = async (recipeId: string) => {
    if (day == null) return;
    await swap(day, recipeId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Swap this meal"
      subtitle="Alternatives built around this week's sales"
      footer={<Button label="Keep Original Meal" variant="secondary" onPress={onClose} fullWidth />}
    >
      {alternatives.length === 0 ? (
        <Text style={styles.empty}>No alternatives available for your current filters.</Text>
      ) : (
        alternatives.map((alt) => (
          <View key={alt.recipe.id} style={styles.altRow}>
            <View style={styles.altImage}>
              <Icon name="restaurant-outline" size={22} color={colors.brandLight} />
            </View>
            <View style={styles.altBody}>
              <View style={styles.altHeader}>
                <Text style={styles.altName}>{alt.recipe.name}</Text>
                {alt.savings > 0 ? <Badge label={`Save $${alt.savings.toFixed(2)}`} /> : null}
              </View>
              <View style={styles.metaRow}>
                <Icon name="time-outline" size={13} color={colors.textMuted} />
                <Text style={styles.meta}>{alt.recipe.cookTimeMinutes} min</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.meta}>${alt.estimatedCost.toFixed(2)}</Text>
              </View>
              <Text style={styles.rationale}>{alt.rationale}</Text>
              <View style={styles.swapAction}>
                <Button label="Swap in" onPress={() => onSwapIn(alt.recipe.id)} />
              </View>
            </View>
          </View>
        ))
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, fontSize: fontSizes.md, textAlign: 'center', paddingVertical: spacing.xl },
  altRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  altImage: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altBody: { flex: 1, gap: spacing.xs },
  altHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  altName: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.text, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { fontSize: fontSizes.sm, color: colors.textMuted },
  dot: { color: colors.textFaint },
  rationale: { fontSize: fontSizes.sm, color: colors.text, marginTop: 2 },
  swapAction: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xs },
});
