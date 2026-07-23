import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import {
  DISCOVERY_STEP,
  ONBOARDING_STEP_COUNT,
  ONBOARDING_STEP_ROUTE,
  isStepReachable,
  nextReachableStep,
  prevReachableStep,
  type OnboardingReachabilityInput,
} from '@/domain/onboardingSteps';
import { useDiscoveryStore } from '@/state/discoveryStore';
import { usePreferencesStore } from '@/state/preferencesStore';

/**
 * Centered onboarding card with the leaf brand mark and step dots, matching
 * the mobile funnel mockups. Used across postal → discovery → stores →
 * preferences.
 *
 * The scaffold owns step navigation: the dots are tappable (dimmed when the
 * target is unreachable; the discovery dot is never tappable) and flanked by
 * chevrons that jump to the previous/next reachable step. It reads the zustand
 * stores itself so each screen only has to pass its own `step`.
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
  const router = useRouter();
  const result = useDiscoveryStore((s) => s.result);
  const prefs = usePreferencesStore((s) => s.preferences);
  const input: OnboardingReachabilityInput = { result, prefs };

  const goTo = (target: number) => {
    const route = ONBOARDING_STEP_ROUTE[target];
    if (route) router.replace(route as Parameters<typeof router.replace>[0]);
  };

  const prev = prevReachableStep(step, input);
  const next = nextReachableStep(step, input);

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

          <View style={styles.nav}>
            <ChevronButton
              direction="back"
              disabled={prev == null}
              onPress={() => prev != null && goTo(prev)}
            />

            <View style={styles.dots}>
              {Array.from({ length: ONBOARDING_STEP_COUNT }).map((_, i) => {
                const isDiscovery = i === DISCOVERY_STEP;
                const reachable = isStepReachable(i, input);
                const isCurrent = i === step;
                const tappable = reachable && !isCurrent;
                return (
                  <Pressable
                    key={i}
                    disabled={!tappable}
                    onPress={() => goTo(i)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !tappable, selected: isCurrent }}
                  >
                    <View
                      style={[
                        styles.dot,
                        isCurrent && styles.dotActive,
                        !reachable && !isCurrent && styles.dotDisabled,
                        isDiscovery && !isCurrent && styles.dotDisabled,
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>

            <ChevronButton
              direction="forward"
              disabled={next == null}
              onPress={() => next != null && goTo(next)}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ChevronButton({
  direction,
  disabled,
  onPress,
}: {
  direction: 'back' | 'forward';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={[styles.chevron, disabled && styles.chevronDisabled]}
      accessibilityRole="button"
      accessibilityLabel={direction === 'back' ? 'Previous step' : 'Next step'}
      accessibilityState={{ disabled }}
    >
      <Icon
        name={direction === 'back' ? 'chevron-back' : 'chevron-forward'}
        size={18}
        color={disabled ? colors.textFaint : colors.brand}
      />
    </Pressable>
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

  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  chevron: { padding: spacing.xs, borderRadius: radii.sm },
  chevronDisabled: { opacity: 0.35 },

  dots: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.brand, width: 22 },
  dotDisabled: { opacity: 0.4 },
});
