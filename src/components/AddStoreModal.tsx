import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Chain } from '@/domain/types';
import { CHAIN_LABELS } from '@/domain/types';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Button } from '@/ui/primitives';
import { Modal } from '@/ui/Overlay';
import { useDiscoveryStore } from '@/state/discoveryStore';
import { addableChains } from '@/data/deals';

/**
 * "Add a store" modal for the shopping-list screen. Lists every chain not yet
 * present in the current discovery result, using the same add-row visual
 * language as onboarding (logo square, chain label, subtitle, Add button).
 *
 * Adding calls addStoreAndSelect (append store + deals AND persist the
 * selection so pricing actually uses it), then hands the chain back to the
 * parent via onAdded. UX decision: the modal CLOSES on add so the screen's
 * transient "…prices updated" confirmation is visible behind it; the parent
 * owns both the message and the close.
 */
export function AddStoreModal({
  visible,
  onClose,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: (chain: Chain) => void;
}) {
  const stores = useDiscoveryStore((s) => s.result?.stores);
  const addStoreAndSelect = useDiscoveryStore((s) => s.addStoreAndSelect);
  const chains = addableChains(stores ?? []);

  const onAdd = async (chain: Chain) => {
    await addStoreAndSelect(chain);
    onAdded(chain);
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Add a store"
      subtitle="Include another chain's flyer deals in your list"
    >
      {chains.length === 0 ? (
        <Text style={styles.empty}>All supported chains already added</Text>
      ) : (
        chains.map((chain) => (
          <View key={chain} style={styles.addRow}>
            <View style={styles.addLogo}>
              <Text style={styles.addLogoText}>{CHAIN_LABELS[chain].slice(0, 2)}</Text>
            </View>
            <View style={styles.addBody}>
              <Text style={styles.addName}>{CHAIN_LABELS[chain]}</Text>
              <Text style={styles.addMeta}>Add this chain's flyer deals</Text>
            </View>
            <Button
              label="Add"
              variant="secondary"
              icon="add"
              onPress={() => onAdd(chain)}
            />
          </View>
        ))
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  addLogo: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.sidebar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLogoText: { color: colors.onBrand, fontWeight: fontWeights.bold, fontSize: fontSizes.sm },
  addBody: { flex: 1 },
  addName: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.text },
  addMeta: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: 2 },
});
