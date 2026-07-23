import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Badge } from '@/ui/primitives';
import { Modal } from '@/ui/Overlay';
import { formatUnitPrice } from '@/domain/format';
import { useDiscoveryStore } from '@/state/discoveryStore';

/** Whole-percent discount, guarding against a zero/negative regular price. */
function discountPct(salePrice: number, regularPrice: number): number {
  if (regularPrice <= 0) return 0;
  return Math.round((1 - salePrice / regularPrice) * 100);
}

/** "Jul 20 – Aug 2" style validity window from two YYYY-MM-DD strings. */
function formatValidity(from: string, to: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

/**
 * Modal (not a route — the underlying deals live in transient zustand state)
 * listing this week's flyer specials for one store, opened by tapping the store
 * name in the shopping list. Deals are sorted by discount, deepest first.
 */
export function StoreSpecialsModal({
  storeId,
  storeName,
  visible,
  onClose,
}: {
  storeId: string;
  storeName: string;
  visible: boolean;
  onClose: () => void;
}) {
  const deals = useDiscoveryStore((s) => s.result?.deals);

  const storeDeals = useMemo(() => {
    return (deals ?? [])
      .filter((d) => d.storeId === storeId)
      .slice()
      .sort(
        (a, b) =>
          discountPct(b.salePrice, b.regularPrice) -
          discountPct(a.salePrice, a.regularPrice),
      );
  }, [deals, storeId]);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={storeName}
      subtitle="This week's flyer specials"
    >
      {storeDeals.length === 0 ? (
        <Text style={styles.empty}>No current specials for this store.</Text>
      ) : (
        storeDeals.map((deal) => {
          const pct = discountPct(deal.salePrice, deal.regularPrice);
          return (
            <View key={deal.id} style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.label}>{deal.label}</Text>
                <Text style={styles.validity}>
                  {formatValidity(deal.validFrom, deal.validTo)}
                </Text>
              </View>
              <View style={styles.priceCol}>
                <View style={styles.priceRow}>
                  <Text style={styles.sale}>
                    {formatUnitPrice(deal.salePrice, deal.unit)}
                  </Text>
                  <Text style={styles.regular}>
                    {formatUnitPrice(deal.regularPrice, deal.unit)}
                  </Text>
                </View>
                {pct > 0 ? <Badge label={`-${pct}%`} /> : null}
              </View>
            </View>
          );
        })
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  info: { flex: 1, gap: 2 },
  label: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.text },
  validity: { fontSize: fontSizes.xs, color: colors.textMuted },
  priceCol: { alignItems: 'flex-end', gap: spacing.xs },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  sale: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.success },
  regular: {
    fontSize: fontSizes.sm,
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
});
