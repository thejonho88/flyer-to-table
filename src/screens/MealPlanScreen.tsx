import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSizes, fontWeights, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Button, Card } from '@/ui/primitives';
import { getRecipe } from '@/data/recipes';
import { usePlanStore } from '@/state/planStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { StatsBar } from '@/components/StatsBar';
import { MealCard } from '@/components/MealCard';
import { SwapModal } from '@/components/SwapModal';
import { PreferencesDrawer } from '@/components/PreferencesDrawer';
import { formatWeekOf } from '@/domain/dates';

export function MealPlanScreen() {
  const router = useRouter();
  const plan = usePlanStore((s) => s.plan);
  const generate = usePlanStore((s) => s.generate);
  const status = usePlanStore((s) => s.status);
  const postal = usePreferencesStore((s) => s.preferences?.postalCode);

  const [swapDay, setSwapDay] = useState<number | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  if (!plan) {
    return (
      <View style={styles.emptyWrap}>
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Icon name="restaurant-outline" size={28} color={colors.brand} />
          </View>
          <Text style={styles.emptyTitle}>No meal plan yet</Text>
          <Text style={styles.emptyText}>
            Generate a weekly plan built around this week's local flyer deals.
          </Text>
          <Button
            label="Generate Meal Plan"
            icon="sparkles"
            loading={status === 'generating'}
            onPress={() => generate()}
          />
        </Card>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Your Weekly Meal Plan</Text>
            <Text style={styles.subtitle}>
              {formatWeekOf(plan.weekOf)} · Based on local flyer deals near{' '}
              <Text style={styles.accent}>{postal}</Text>{' '}
              <Text
                style={styles.link}
                onPress={() => router.push('/onboarding/postal')}
              >
                Edit location
              </Text>
            </Text>
          </View>
          <Button label="Adjust Preferences" icon="options-outline" variant="secondary" onPress={() => setPrefsOpen(true)} />
        </View>

        <StatsBar plan={plan} onGenerateList={() => router.push('/shopping-list')} />

        <View style={styles.grid}>
          {plan.meals.map((meal) => {
            const recipe = getRecipe(meal.recipeId);
            if (!recipe) return null;
            return (
              <MealCard
                key={`${meal.day}-${meal.recipeId}`}
                meal={meal}
                recipe={recipe}
                onSwap={() => setSwapDay(meal.day)}
              />
            );
          })}
        </View>

        <Card style={styles.refine}>
          <View style={styles.refineLeft}>
            <Icon name="create-outline" size={20} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.refineTitle}>Refine your plan</Text>
              <Text style={styles.refineText}>
                Adjust household size, dietary preferences, budget guidance, and more.
              </Text>
            </View>
          </View>
          <Button label="Open Preferences" variant="secondary" onPress={() => setPrefsOpen(true)} />
        </Card>
      </ScrollView>

      <SwapModal day={swapDay} visible={swapDay != null} onClose={() => setSwapDay(null)} />
      <PreferencesDrawer visible={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, flexWrap: 'wrap' },
  title: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold, color: colors.text },
  subtitle: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },
  accent: { color: colors.brand, fontWeight: fontWeights.semibold },
  link: { color: colors.brand, fontWeight: fontWeights.semibold, textDecorationLine: 'underline' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },

  refine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, flexWrap: 'wrap' },
  refineLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minWidth: 220 },
  refineTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.text },
  refineText: { fontSize: fontSizes.sm, color: colors.textMuted },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyCard: { maxWidth: 420, alignItems: 'center', gap: spacing.md },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.text },
  emptyText: { fontSize: fontSizes.md, color: colors.textMuted, textAlign: 'center' },
});
