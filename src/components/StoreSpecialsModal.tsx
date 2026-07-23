import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Badge, Button } from '@/ui/primitives';
import { Icon } from '@/ui/Icon';
import { Modal } from '@/ui/Overlay';
import { formatUnitPrice, formatDualMassPrice } from '@/domain/format';
import { isMassUnit } from '@/domain/units';
import { CHAIN_FLYER_URLS } from '@/data/flyerUrls';
import { openExternalUrl } from '@/services/links';
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
 * name in the shopping list. Deals are sorted by discount, deepest first. Mass
 * deals show a dual $/lb · $/kg price so the shelf tag and recipe unit both read
 * cleanly; each deal and the store footer link out to the source flyer.
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
  const stores = useDiscoveryStore((s) => s.result?.stores);

  const store = useMemo(
    () => (stores ?? []).find((s) => s.id === storeId),
    [stores, storeId],
  );

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

  const flyerUrl =
    store?.flyerUrl ?? (store ? CHAIN_FLYER_URLS[store.chain] : undefined);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={storeName}
      subtitle="This week's flyer specials"
      footer={
        <View style={styles.footerContent}>
          {flyerUrl ? (
            <Button
              label="View full flyer"
              icon="open-outline"
              variant="secondary"
              fullWidth
              onPress={() => openExternalUrl(flyerUrl)}
            />
          ) : null}
          <Text style={styles.cadNote}>All prices in CAD</Text>
        </View>
      }
    >
      {storeDeals.length === 0 ? (
        <Text style={styles.empty}>No current specials for this store.</Text>
      ) : (
        storeDeals.map((deal) => {
          const pct = discountPct(deal.salePrice, deal.regularPrice);
          return (
            <View key={deal.id} style={styles.row}>
              <View style={styles.info}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{deal.label}</Text>
                  {deal.sourceUrl ? (
                    <Pressable
                      onPress={() => openExternalUrl(deal.sourceUrl!)}
                      hitSlop={8}
                      accessibilityLabel={`Open flyer source for ${deal.label}`}
                    >
                      <Icon name="open-outline" size={14} color={colors.brand} />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.validity}>
                  {formatValidity(deal.validFrom, deal.validTo)}
                </Text>
              </View>
              <View style={styles.priceCol}>
                <View style={styles.priceRow}>
                  <Text style={styles.sale}>
                    {isMassUnit(deal.unit)
                      ? formatDualMassPrice(deal.salePrice, deal.unit)
                      : formatUnitPrice(deal.salePrice, deal.unit)}
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.text },
  validity: { fontSize: fontSizes.xs, color: colors.textMuted },
  priceCol: { alignItems: 'flex-end', gap: spacing.xs },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'flex-end' },
  sale: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.success },
  regular: {
    fontSize: fontSizes.sm,
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
  footerContent: { flex: 1, gap: spacing.sm },
  cadNote: { fontSize: fontSizes.xs, color: colors.textFaint, textAlign: 'center' },
});
