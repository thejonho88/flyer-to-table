import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';

const TOTAL_STEPS = 4;

/**
 * Centered onboarding card with the leaf brand mark and step dots, matching
 * the mobile funnel mockups. Used across postal → discovery → stores →
 * preferences.
 */
export function OnboardingScaffold({
  step,
  children,
  wide = false,
}: {
  step: number;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, wide && styles.cardWide]}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Icon name="leaf" size={20} color={colors.onBrand} />
            </View>
            <Text style={styles.brandText}>Flyer to Table</Text>
          </View>

          {children}

          <View style={styles.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  cardWide: { maxWidth: 620 },
  brand: { alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.text },
  dots: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.brand, width: 22 },
});
