import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Store } from '@/domain/types';
import { CHAIN_LABELS } from '@/domain/types';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Checkbox } from '@/ui/primitives';

export function StoreSelectCard({
  store,
  selected,
  onToggle,
}: {
  store: Store;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={styles.logo}>
        <Text style={styles.logoText}>{CHAIN_LABELS[store.chain].slice(0, 2)}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{store.name}</Text>
        <View style={styles.metaRow}>
          <Icon name="navigate-outline" size={12} color={colors.textMuted} />
          <Text style={styles.meta}>{store.distanceKm.toFixed(1)} km</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{store.dealCount} deals</Text>
        </View>
      </View>
      <Checkbox checked={selected} onPress={onToggle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardSelected: { borderColor: colors.brand, backgroundColor: colors.successBg },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.sidebar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.onBrand, fontWeight: fontWeights.bold, fontSize: fontSizes.sm },
  body: { flex: 1 },
  name: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  meta: { fontSize: fontSizes.sm, color: colors.textMuted },
  dot: { color: colors.textFaint },
});
