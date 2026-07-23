import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { usePreferencesStore } from '@/state/preferencesStore';

export function Header({ narrow }: { narrow: boolean }) {
  const router = useRouter();
  const postal = usePreferencesStore((s) => s.preferences?.postalCode);

  return (
    <View style={styles.header}>
      {narrow ? (
        <View style={styles.brandNarrow}>
          <View style={styles.logo}>
            <Icon name="leaf" size={16} color={colors.onBrand} />
          </View>
          <Text style={styles.brandText}>Flyer to Table</Text>
        </View>
      ) : (
        <View style={styles.searchBar}>
          <Icon name="search" size={16} color={colors.textFaint} />
          <Text style={styles.searchPlaceholder}>Search meals, ingredients, stores…</Text>
        </View>
      )}

      <View style={styles.right}>
        <Pressable
          style={styles.postalChip}
          onPress={() => router.push('/onboarding/postal')}
          accessibilityLabel="Change postal code"
        >
          <Icon name="location-outline" size={14} color={colors.brand} />
          <Text style={styles.postalText}>{postal ?? 'Set location'}</Text>
        </Pressable>
        <View style={styles.avatar}>
          <Icon name="person" size={16} color={colors.onBrand} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.lg,
  },
  brandNarrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.text },

  searchBar: {
    flex: 1,
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchPlaceholder: { color: colors.textFaint, fontSize: fontSizes.sm },

  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  postalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.successBg,
  },
  postalText: { color: colors.brand, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
