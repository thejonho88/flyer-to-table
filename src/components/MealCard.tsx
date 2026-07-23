import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlannedMeal, Recipe } from '@/domain/types';
import { colors, fontSizes, fontWeights, radii, shadow, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Badge } from '@/ui/primitives';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function MealCard({
  meal,
  recipe,
  onSwap,
}: {
  meal: PlannedMeal;
  recipe: Recipe;
  onSwap: () => void;
}) {
  const onSale = meal.saleIngredientIds.length > 0;
  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <Icon name="restaurant-outline" size={28} color={colors.brandLight} />
        <Pressable style={styles.swapBtn} onPress={onSwap} accessibilityLabel="Swap meal">
          <Icon name="swap-horizontal" size={16} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <Text style={styles.weekday}>{WEEKDAYS[meal.day % 7]}</Text>
        <Text style={styles.name} numberOfLines={2}>
          {recipe.name}
        </Text>
        <View style={styles.timeRow}>
          <Icon name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.time}>{recipe.cookTimeMinutes} min</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>${meal.estimatedCost.toFixed(2)}</Text>
          {onSale ? <Badge label="On Sale" tone="success" /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 180,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  imageWrap: {
    height: 110,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  body: { padding: spacing.md, gap: spacing.xs },
  weekday: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.text, minHeight: 40 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  time: { fontSize: fontSizes.sm, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  price: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.text },
});
