import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ShoppingMode } from '@/domain/shoppingMode';
import type { StoreTotal } from '@/domain/storeComparison';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Chip, SegmentedSlider } from '@/ui/primitives';
import { formatMoney } from '@/domain/money';

/**
 * Shopping-mode control for the Shopping List screen (NOT the Preferences
 * drawer). A segmented "All my stores | One store" toggle; in single mode a
 * chip row of candidate stores, each labelled "Maxi · $172" — the picker
 * doubles as a per-store cost comparison. Purely presentational: the screen
 * owns the preference writes and the regenerate/warning banners.
 */
export function ShoppingModeControl({
  mode,
  onModeChange,
  candidates,
  selectedStoreId,
  onSelectStore,
}: {
  mode: ShoppingMode;
  onModeChange: (mode: ShoppingMode) => void;
  /** Candidate stores with their one-stop totals, cheapest first. */
  candidates: StoreTotal[];
  selectedStoreId?: string;
  onSelectStore: (storeId: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Shopping trip</Text>
        <View style={styles.segment}>
          <SegmentedSlider<ShoppingMode>
            options={[
              { label: 'All my stores', value: 'multi' },
              { label: 'One store', value: 'single' },
            ]}
            value={mode}
            onChange={onModeChange}
          />
        </View>
      </View>

      {mode === 'single' ? (
        <View style={styles.chipRow}>
          {candidates.map((c) => (
            <Chip
              key={c.store.id}
              label={`${c.store.name} · ${formatMoney(c.total)}`}
              selected={c.store.id === selectedStoreId}
              onPress={() => onSelectStore(c.store.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  label: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.text },
  segment: { minWidth: 240 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
