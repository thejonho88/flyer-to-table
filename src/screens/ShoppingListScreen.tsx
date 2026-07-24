import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Chain, ShoppingListItem } from '@/domain/types';
import { CHAIN_LABELS } from '@/domain/types';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Button, Card, Checkbox, InfoChip, Badge } from '@/ui/primitives';
import { usePlanStore } from '@/state/planStore';
import { useChecklistStore } from '@/state/checklistStore';
import { useDiscoveryStore } from '@/state/discoveryStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { itemKey, shoppingListStats } from '@/domain/shoppingList';
import { formatWeekOf } from '@/domain/dates';
import { formatQty, formatUnitPrice } from '@/domain/format';
import { formatMoney } from '@/domain/money';
import { shareText, shoppingListToText } from '@/services/share';
import { StoreSpecialsModal } from '@/components/StoreSpecialsModal';
import { AddStoreModal } from '@/components/AddStoreModal';

export function ShoppingListScreen() {
  const router = useRouter();
  const plan = usePlanStore((s) => s.plan);
  const buildList = usePlanStore((s) => s.shoppingList);
  const checked = useChecklistStore((s) => s.checked);
  const toggle = useChecklistStore((s) => s.toggle);
  // buildList reads discovery/prefs via getState(), so those reads are invisible
  // to React. Subscribe to the underlying state objects (not derived arrays, to
  // avoid re-render loops) and feed them into the memo so the list recomputes
  // when a store is added or the selection changes.
  const result = useDiscoveryStore((s) => s.result);
  const preferences = usePreferencesStore((s) => s.preferences);

  const list = useMemo(() => buildList(), [buildList, plan, result, preferences]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [addStoreOpen, setAddStoreOpen] = useState(false);
  const [specialsStore, setSpecialsStore] = useState<{ id: string; name: string } | null>(null);

  const onStoreAdded = (chain: Chain) => {
    setAddStoreOpen(false);
    setAddMsg(
      `${CHAIN_LABELS[chain]} added — prices updated. Regenerate your plan to optimize meals around it.`,
    );
    setTimeout(() => setAddMsg(null), 5000);
  };

  if (!plan || !list) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>No shopping list yet</Text>
        <Text style={styles.emptyText}>Generate a meal plan first, then come back here.</Text>
        <Button label="Go to Meal Plan" onPress={() => router.push('/home')} />
      </View>
    );
  }

  const stats = shoppingListStats(list);
  const checkedCount = list.storeGroups.reduce(
    (sum, g) =>
      sum + g.items.filter((i) => checked[itemKey(g.store.id, i.ingredientId)]).length,
    0,
  );

  const onShare = async () => {
    const shareResult = await shareText(shoppingListToText(list));
    setShareMsg(
      shareResult === 'shared'
        ? 'Shared!'
        : shareResult === 'copied'
          ? 'List copied to clipboard'
          : 'Could not share list',
    );
    setTimeout(() => setShareMsg(null), 2500);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Shopping List</Text>
          <Text style={styles.subtitle}>
            {formatWeekOf(plan.weekOf)} · Based on this week's flyer deals
          </Text>
        </View>
        <Pressable style={styles.backLink} onPress={() => router.push('/home')}>
          <Icon name="arrow-back" size={16} color={colors.brand} />
          <Text style={styles.backText}>Back to Meal Plan</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        <InfoChip icon="checkmark-circle-outline" label={`${checkedCount} of ${stats.totalItems} items checked`} />
        <InfoChip icon="pricetag-outline" label={`${stats.onSaleItems} items on sale`} />
        <InfoChip icon="storefront-outline" label={`${stats.storeCount} stores`} />
      </View>

      {addMsg ? (
        <View style={styles.addBanner}>
          <Icon name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.addBannerText}>{addMsg}</Text>
        </View>
      ) : null}

      {list.storeGroups.map((group) => {
        const isCollapsed = collapsed[group.store.id];
        return (
          <Card key={group.store.id} padded={false} style={styles.storeCard}>
            <Pressable
              style={styles.storeHeader}
              onPress={() => setCollapsed((c) => ({ ...c, [group.store.id]: !c[group.store.id] }))}
            >
              <Icon name={isCollapsed ? 'chevron-forward' : 'chevron-down'} size={18} color={colors.text} />
              <Pressable
                onPress={(e) => {
                  // Nested press: open specials without toggling the collapse header.
                  e.stopPropagation();
                  setSpecialsStore({ id: group.store.id, name: group.store.name });
                }}
                hitSlop={6}
              >
                <Text style={[styles.storeName, styles.storeNameLink]}>{group.store.name}</Text>
              </Pressable>
              <Text style={styles.storeChain}>{CHAIN_LABELS[group.store.chain]}</Text>
              <Text style={styles.storeItems}>{group.items.length} items</Text>
              <Text style={styles.storeSubtotal}>{formatMoney(group.subtotal)}</Text>
            </Pressable>

            {!isCollapsed
              ? group.items.map((item, idx) => {
                  const key = itemKey(group.store.id, item.ingredientId);
                  return (
                    <ItemRow
                      key={item.ingredientId}
                      item={item}
                      last={idx === group.items.length - 1}
                      checked={!!checked[key]}
                      onToggle={() => toggle(key)}
                    />
                  );
                })
              : null}
          </Card>
        );
      })}

      <Pressable style={styles.addStoreRow} onPress={() => setAddStoreOpen(true)}>
        <Icon name="add-circle-outline" size={20} color={colors.brand} />
        <Text style={styles.addStoreText}>Add a store</Text>
      </Pressable>

      <Card style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Estimated Weekly Total</Text>
          <Text style={styles.footerTotal}>{formatMoney(list.totals.estimated)}</Text>
          <Text style={styles.cadNote}>All prices in CAD</Text>
        </View>
        <View style={styles.footerRight}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.savings}>You save {formatMoney(list.totals.savings)}</Text>
            <Text style={styles.savingsSub}>vs. regular prices</Text>
          </View>
          <Button label={shareMsg ?? 'Share List'} icon="share-outline" onPress={onShare} />
        </View>
      </Card>

      <StoreSpecialsModal
        visible={!!specialsStore}
        storeId={specialsStore?.id ?? ''}
        storeName={specialsStore?.name ?? ''}
        onClose={() => setSpecialsStore(null)}
      />

      <AddStoreModal
        visible={addStoreOpen}
        onClose={() => setAddStoreOpen(false)}
        onAdded={onStoreAdded}
      />
    </ScrollView>
  );
}

function ItemRow({
  item,
  checked,
  onToggle,
  last,
}: {
  item: ShoppingListItem;
  checked: boolean;
  onToggle: () => void;
  last: boolean;
}) {
  return (
    <View style={[styles.itemRow, !last && styles.itemRowBorder]}>
      <Checkbox checked={checked} onPress={onToggle} />
      <Text style={[styles.itemLabel, checked && styles.itemLabelChecked]}>{item.label}</Text>
      <View style={styles.itemRight}>
        {item.onSale ? <Badge label="SALE" tone="success" /> : null}
        <Text style={styles.itemQty}>
          {`${formatQty(item.quantity, item.unit)} × ${formatUnitPrice(item.unitPrice, item.unit)}`}
        </Text>
        <Text style={styles.itemPrice}>{formatMoney(item.lineTotal)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.lg, maxWidth: 900, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, flexWrap: 'wrap' },
  title: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold, color: colors.text },
  subtitle: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { color: colors.brand, fontWeight: fontWeights.semibold, fontSize: fontSizes.sm },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  addBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  addBannerText: { flex: 1, fontSize: fontSizes.sm, color: colors.text },

  addStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  addStoreText: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.brand },

  storeCard: { overflow: 'hidden' },
  storeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  storeName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.text },
  storeNameLink: { color: colors.brand, textDecorationLine: 'underline' },
  storeChain: { fontSize: fontSizes.xs, color: colors.textMuted, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
  storeItems: { fontSize: fontSizes.sm, color: colors.textMuted, marginLeft: 'auto' },
  storeSubtotal: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.success },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  itemLabel: { flex: 1, fontSize: fontSizes.md, color: colors.text },
  itemLabelChecked: { color: colors.textFaint, textDecorationLine: 'line-through' },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemQty: { fontSize: fontSizes.sm, color: colors.textMuted },
  itemPrice: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.text, minWidth: 60, textAlign: 'right' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, flexWrap: 'wrap' },
  footerLabel: { fontSize: fontSizes.sm, color: colors.textMuted },
  footerTotal: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold, color: colors.text },
  cadNote: { fontSize: fontSizes.xs, color: colors.textFaint, marginTop: 2 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  savings: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.success },
  savingsSub: { fontSize: fontSizes.xs, color: colors.textMuted },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.text },
  emptyText: { fontSize: fontSizes.md, color: colors.textMuted, textAlign: 'center' },
});
