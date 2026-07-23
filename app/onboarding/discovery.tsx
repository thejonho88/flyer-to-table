import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Button, SkeletonCard } from '@/ui/primitives';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useDiscoveryStore } from '@/state/discoveryStore';

export default function DiscoveryScreen() {
  const router = useRouter();
  const postal = usePreferencesStore((s) => s.preferences?.postalCode);
  const { status, progress, message, foundStores, error, run } = useDiscoveryStore();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !postal) return;
    started.current = true;
    void run(postal);
  }, [postal, run]);

  // Auto-advance once discovery completes successfully.
  useEffect(() => {
    if (status === 'success') {
      const t = setTimeout(() => router.replace('/onboarding/stores'), 500);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  if (status === 'failed') {
    return (
      <OnboardingScaffold step={1}>
        <View style={styles.failWrap}>
          <View style={styles.failIcon}>
            <Icon name="alert-circle-outline" size={30} color={colors.danger} />
          </View>
          <Text style={styles.failTitle}>No local flyers found</Text>
          <Text style={styles.failText}>{error?.message}</Text>
          <Button
            label="Try another postal code"
            onPress={() => router.replace('/onboarding/postal')}
            fullWidth
          />
          <Button
            label="Retry"
            variant="secondary"
            onPress={() => postal && run(postal, { forceRefresh: true })}
            fullWidth
          />
        </View>
      </OnboardingScaffold>
    );
  }

  return (
    <OnboardingScaffold step={1}>
      <View style={styles.head}>
        <Text style={styles.heading}>Looking for grocery deals near you…</Text>
        <Text style={styles.sub}>
          We're checking current flyers from stores in your area.
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.phase}>{message ?? 'Starting…'}</Text>

      <View style={styles.storeList}>
        {foundStores.map((s) => (
          <View key={s.id} style={styles.foundRow}>
            <Icon name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.foundName}>{s.name}</Text>
            <Text style={styles.foundDeals}>{s.dealCount} deals</Text>
          </View>
        ))}
        {foundStores.length === 0 ? (
          <>
            <SkeletonCard height={52} />
            <SkeletonCard height={52} />
            <SkeletonCard height={52} />
          </>
        ) : null}
      </View>

      {foundStores.length > 0 && status === 'running' ? (
        <Pressable onPress={() => router.replace('/onboarding/stores')}>
          <Text style={styles.skip}>Skip to store selection</Text>
        </Pressable>
      ) : null}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs, alignItems: 'center' },
  heading: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.text, textAlign: 'center' },
  sub: { fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center' },

  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.brand },
  phase: { fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center' },

  storeList: { gap: spacing.sm },
  foundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  foundName: { flex: 1, fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.text },
  foundDeals: { fontSize: fontSizes.sm, color: colors.textMuted },

  skip: { textAlign: 'center', color: colors.brand, fontWeight: fontWeights.semibold, fontSize: fontSizes.sm },

  failWrap: { gap: spacing.md, alignItems: 'center' },
  failIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center' },
  failTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.text },
  failText: { fontSize: fontSizes.md, color: colors.textMuted, textAlign: 'center' },
});
