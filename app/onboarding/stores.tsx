import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Chain } from '@/domain/types';
import { CHAIN_LABELS } from '@/domain/types';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/primitives';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { StoreSelectCard } from '@/components/StoreSelectCard';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useDiscoveryStore } from '@/state/discoveryStore';
import { addableChains, addedStoreIdFor } from '@/data/deals';
import { fsaOf } from '@/domain/postal';

export default function StoresScreen() {
  const router = useRouter();
  const result = useDiscoveryStore((s) => s.result);
  const foundStores = useDiscoveryStore((s) => s.foundStores);
  const addStore = useDiscoveryStore((s) => s.addStore);
  const update = usePreferencesStore((s) => s.update);
  const existing = usePreferencesStore((s) => s.preferences?.selectedStoreIds);

  const stores = result?.stores ?? foundStores;
  const [selected, setSelected] = useState<string[]>(existing ?? []);
  const [showAdd, setShowAdd] = useState(false);

  // Chains not already represented among the discovered/added stores.
  const addable = useMemo<Chain[]>(() => addableChains(stores), [stores]);

  const onAddStore = async (chain: Chain) => {
    if (!result) return;
    await addStore(chain);
    // The default-select effect won't re-fire once a selection exists, so the
    // newly added store must be selected here explicitly.
    const id = addedStoreIdFor(chain, fsaOf(result.postalCode));
    setSelected((cur) => (cur.includes(id) ? cur : [...cur, id]));
  };

  // Default: all discovered stores selected.
  useEffect(() => {
    if (selected.length === 0 && stores.length > 0) {
      setSelected(stores.map((s) => s.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores.length]);

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const dealsReady = !!result; // deals loaded -> safe to plan
  const canContinue = dealsReady && selected.length > 0;

  const onContinue = async () => {
    await update({ selectedStoreIds: selected });
    router.push('/onboarding/flyers');
  };

  return (
    <OnboardingScaffold step={2} wide>
      <View style={styles.head}>
        <Text style={styles.heading}>Select Your Stores</Text>
        <Text style={styles.sub}>Choose which stores to include in your plan.</Text>
      </View>

      <View style={styles.banner}>
        <Icon name="information-circle-outline" size={18} color={colors.brand} />
        <Text style={styles.bannerText}>
          More stores means more deals to plan around — but you can shop at just one.
        </Text>
      </View>

      <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={styles.list}>
        {stores.map((store) => (
          <StoreSelectCard
            key={store.id}
            store={store}
            selected={selected.includes(store.id)}
            onToggle={() => toggle(store.id)}
          />
        ))}
      </ScrollView>

      {dealsReady && addable.length > 0 ? (
        <View style={styles.addSection}>
          <Pressable
            style={styles.addHeader}
            onPress={() => setShowAdd((v) => !v)}
          >
            <Icon
              name={showAdd ? 'chevron-down' : 'chevron-forward'}
              size={16}
              color={colors.brand}
            />
            <Text style={styles.addHeaderText}>Add more stores</Text>
            <Text style={styles.addHeaderCount}>{addable.length} available</Text>
          </Pressable>

          {showAdd ? (
            <View style={styles.addList}>
              {addable.map((chain) => (
                <View key={chain} style={styles.addRow}>
                  <View style={styles.addLogo}>
                    <Text style={styles.addLogoText}>
                      {CHAIN_LABELS[chain].slice(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.addBody}>
                    <Text style={styles.addName}>{CHAIN_LABELS[chain]}</Text>
                    <Text style={styles.addMeta}>Add this chain's flyer deals</Text>
                  </View>
                  <Button
                    label="Add"
                    variant="secondary"
                    icon="add"
                    onPress={() => onAddStore(chain)}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {!dealsReady ? (
        <Text style={styles.waiting}>Finishing up flyer extraction…</Text>
      ) : null}

      <Button
        label={`Continue with ${selected.length} store${selected.length === 1 ? '' : 's'}`}
        onPress={onContinue}
        disabled={!canContinue}
        fullWidth
      />
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs, alignItems: 'center' },
  heading: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.text },
  sub: { fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  bannerText: { flex: 1, fontSize: fontSizes.sm, color: colors.text },
  list: { gap: spacing.sm },
  waiting: { textAlign: 'center', fontSize: fontSizes.sm, color: colors.textMuted },

  addSection: { gap: spacing.sm },
  addHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addHeaderText: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.brand },
  addHeaderCount: { fontSize: fontSizes.sm, color: colors.textMuted, marginLeft: 'auto' },
  addList: { gap: spacing.sm },
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
