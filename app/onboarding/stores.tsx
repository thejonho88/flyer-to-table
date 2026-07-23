import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/primitives';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { StoreSelectCard } from '@/components/StoreSelectCard';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useDiscoveryStore } from '@/state/discoveryStore';

export default function StoresScreen() {
  const router = useRouter();
  const result = useDiscoveryStore((s) => s.result);
  const foundStores = useDiscoveryStore((s) => s.foundStores);
  const update = usePreferencesStore((s) => s.update);
  const existing = usePreferencesStore((s) => s.preferences?.selectedStoreIds);

  const stores = result?.stores ?? foundStores;
  const [selected, setSelected] = useState<string[]>(existing ?? []);

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
    router.push('/onboarding/preferences');
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
});
