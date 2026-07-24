import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type {
  Deal,
  FlyerExtractionFailure,
  Store,
  UploadedFlyerFile,
} from '@/domain/types';
import { CHAIN_LABELS } from '@/domain/types';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Button, Toggle } from '@/ui/primitives';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { FlyerDropzone } from '@/components/FlyerDropzone';
import { useDiscoveryStore } from '@/state/discoveryStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import {
  flyerExtractor,
  FlyerExtractionError,
} from '@/services/flyerExtractor';
import { revokeUploadedFile } from '@/services/filePick';
import { CHAIN_FLYER_URLS } from '@/data/flyerUrls';
import { openExternalUrl } from '@/services/links';
import { formatMoney } from '@/domain/money';
import { FAILURE_COPY } from '@/domain/flyerFailureCopy';
import { classifyPrice } from '@/domain/priceBand';
import { BASE_PRICES } from '@/data/pricing';

export default function FlyersScreen() {
  const router = useRouter();
  const result = useDiscoveryStore((s) => s.result);
  const selectedIds = usePreferencesStore(
    (s) => s.preferences?.selectedStoreIds,
  );

  const selectedStores = useMemo<Store[]>(() => {
    const ids = new Set(selectedIds ?? []);
    return (result?.stores ?? []).filter((s) => ids.has(s.id));
  }, [result, selectedIds]);

  return (
    <OnboardingScaffold step={3} wide>
      <View style={styles.head}>
        <Text style={styles.heading}>Bring Your Own Flyer</Text>
        <Text style={styles.sub}>
          Download this week&apos;s flyer for a store, then upload it to plan
          around its real prices. Skip any store and we&apos;ll use our demo
          prices for it instead — uploading is always optional.
        </Text>
      </View>

      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.list}>
        {selectedStores.map((store) => (
          <StoreFlyerCard key={store.id} store={store} />
        ))}
        {selectedStores.length === 0 ? (
          <Text style={styles.empty}>
            No stores selected yet — go back and pick at least one store.
          </Text>
        ) : null}
      </ScrollView>

      <Button
        label="Continue"
        onPress={() => router.push('/onboarding/preferences')}
        fullWidth
      />
    </OnboardingScaffold>
  );
}

/* ------------------------------------------------------------------ */
/* Per-store upload slot                                              */
/* ------------------------------------------------------------------ */

interface EditableRow {
  deal: Deal;
  /** Editable sale-price text (kept as string for the TextInput). */
  salePrice: string;
  included: boolean;
  /** True when the typed sale price exceeds the regular price (was clamped). */
  clamped: boolean;
  /**
   * True when the CURRENT (typed) sale price is in the price-plausibility
   * 'suspicious' band. Seeded from the server flag, then recomputed live as the
   * user edits the price so the warning clears/sets in real time.
   */
  suspicious: boolean;
}

/**
 * Is this sale price (in the deal's flyer unit) in the 'suspicious' band for its
 * ingredient? Non-finite prices are treated as not-suspicious (the clamp/apply
 * guards handle those); the classifier abstains when there is no base price.
 */
function isSuspiciousPrice(price: number, deal: Deal): boolean {
  if (!Number.isFinite(price)) return false;
  return classifyPrice(price, deal.unit, BASE_PRICES[deal.ingredientId]) ===
    'suspicious';
}

type Slot =
  | { phase: 'idle' }
  | { phase: 'extracting'; fileName: string; message: string; progress: number }
  | { phase: 'error'; fileName: string; reason: FlyerExtractionFailure }
  | { phase: 'confirm'; fileName: string; rows: EditableRow[] }
  | { phase: 'applied'; fileName: string; count: number };

export function StoreFlyerCard({ store }: { store: Store }) {
  const applyExtraction = useDiscoveryStore((s) => s.applyExtraction);
  const [slot, setSlot] = useState<Slot>({ phase: 'idle' });

  const flyerUrl = store.flyerUrl ?? CHAIN_FLYER_URLS[store.chain];

  const runExtraction = async (file: UploadedFlyerFile) => {
    setSlot({
      phase: 'extracting',
      fileName: file.name,
      message: 'Reading flyer…',
      progress: 0.05,
    });
    try {
      const deals = await flyerExtractor.extract(
        { file, storeId: store.id, chain: store.chain },
        {
          onEvent: (e) =>
            setSlot((cur) =>
              cur.phase === 'extracting'
                ? { ...cur, message: e.message, progress: e.progress }
                : cur,
            ),
        },
      );
      setSlot({
        phase: 'confirm',
        fileName: file.name,
        rows: deals.map((deal) => {
          const suspicious = deal.suspicious ?? false;
          return {
            deal,
            salePrice: String(deal.salePrice),
            // Suspicious deals default to EXCLUDED — the user must vet the price
            // before it counts. Clean deals are included as before.
            included: !suspicious,
            clamped: false,
            suspicious,
          };
        }),
      });
    } catch (err) {
      const reason =
        err instanceof FlyerExtractionError ? err.reason : 'error';
      setSlot({ phase: 'error', fileName: file.name, reason });
    } finally {
      // The object URL was never read by the mock; release it either way.
      revokeUploadedFile(file);
    }
  };

  const setRow = (index: number, patch: Partial<EditableRow>) =>
    setSlot((cur) =>
      cur.phase === 'confirm'
        ? {
            ...cur,
            rows: cur.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
          }
        : cur,
    );

  const onEditPrice = (index: number, text: string, deal: Deal) => {
    const parsed = parseFloat(text);
    const clamped = Number.isFinite(parsed) && parsed > deal.regularPrice;
    // Re-classify against the ingredient's base price so the "unusual price"
    // warning clears/sets live as the user corrects the number.
    const suspicious = isSuspiciousPrice(parsed, deal);
    setRow(index, { salePrice: text, clamped, suspicious });
  };

  const removeRow = (index: number) =>
    setSlot((cur) =>
      cur.phase === 'confirm'
        ? { ...cur, rows: cur.rows.filter((_, i) => i !== index) }
        : cur,
    );

  const onApply = async () => {
    if (slot.phase !== 'confirm') return;
    const committed: Deal[] = slot.rows
      .filter((r) => r.included)
      .map((r) => {
        const parsed = parseFloat(r.salePrice);
        const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        const salePrice = Math.min(safe, r.deal.regularPrice);
        const edited = salePrice !== r.deal.salePrice;
        // Strip the suspicious flag from whatever the user chose to commit — the
        // user has vetted it, so it enters the plan as a normal deal.
        const { suspicious: _suspicious, ...cleanDeal } = r.deal;
        return {
          ...cleanDeal,
          salePrice,
          provenance: edited ? ('edited' as const) : ('extracted' as const),
        };
      });
    await applyExtraction(store.id, slot.fileName, committed);
    setSlot({
      phase: 'applied',
      fileName: slot.fileName,
      count: committed.length,
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>
            {CHAIN_LABELS[store.chain].slice(0, 2)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.storeMeta}>{CHAIN_LABELS[store.chain]}</Text>
        </View>
      </View>

      <Pressable
        style={styles.downloadRow}
        onPress={() => openExternalUrl(flyerUrl)}
        accessibilityRole="link"
      >
        <Icon name="open-outline" size={16} color={colors.brand} />
        <Text style={styles.downloadText}>Download this week&apos;s flyer ↗</Text>
      </Pressable>

      {slot.phase === 'idle' ? (
        <FlyerDropzone onFile={runExtraction} />
      ) : null}

      {slot.phase === 'extracting' ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{slot.message}</Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(slot.progress * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.fileName}>{slot.fileName}</Text>
        </View>
      ) : null}

      {slot.phase === 'error' ? (
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={18} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorText}>{FAILURE_COPY[slot.reason]}</Text>
            <Text style={styles.fileName}>{slot.fileName}</Text>
          </View>
          <Button
            label="Retry"
            variant="secondary"
            icon="refresh"
            onPress={() => setSlot({ phase: 'idle' })}
          />
        </View>
      ) : null}

      {slot.phase === 'confirm' ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmTitle}>
            Confirm deals from {slot.fileName}
          </Text>
          {slot.rows.length === 0 ? (
            <Text style={styles.storeMeta}>
              No deals left. Re-upload to start over.
            </Text>
          ) : (
            slot.rows.map((row, i) => (
              <View
                key={row.deal.id}
                style={[styles.dealRow, row.suspicious && styles.dealRowWarn]}
              >
                <View style={styles.dealMain}>
                  <Text style={styles.dealLabel}>{row.deal.label}</Text>
                  <Text style={styles.dealRegular}>
                    reg. {formatMoney(row.deal.regularPrice)}/{row.deal.unit}
                  </Text>
                  {row.suspicious ? (
                    <View style={styles.suspectRow}>
                      <Icon
                        name="alert-circle"
                        size={13}
                        color={colors.warning}
                      />
                      <Text style={styles.suspectText}>
                        Unusual price — double-check against the flyer
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.priceCol}>
                  <View
                    style={[
                      styles.priceInputWrap,
                      row.suspicious && styles.priceInputWrapWarn,
                    ]}
                  >
                    <Text style={styles.dollar}>$</Text>
                    <TextInput
                      value={row.salePrice}
                      onChangeText={(t) => onEditPrice(i, t, row.deal)}
                      keyboardType="decimal-pad"
                      style={styles.priceInput}
                      accessibilityLabel={`Sale price for ${row.deal.label}`}
                    />
                    <Text style={styles.perUnit}>/{row.deal.unit}</Text>
                  </View>
                  {row.clamped ? (
                    <Text style={styles.warnText}>
                      Capped at regular price
                    </Text>
                  ) : null}
                </View>
                <Toggle
                  value={row.included}
                  onChange={(v) => setRow(i, { included: v })}
                />
                <Pressable
                  onPress={() => removeRow(i)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${row.deal.label}`}
                >
                  <Icon name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ))
          )}
          <Button
            label={`Apply ${slot.rows.filter((r) => r.included).length} deals`}
            icon="checkmark"
            onPress={onApply}
            disabled={slot.rows.filter((r) => r.included).length === 0}
            fullWidth
          />
        </View>
      ) : null}

      {slot.phase === 'applied' ? (
        <View style={styles.appliedBox}>
          <Icon name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.appliedText}>
            {slot.count} deal{slot.count === 1 ? '' : 's'} applied to{' '}
            {store.name}
          </Text>
          <Button
            label="Re-upload"
            variant="ghost"
            icon="refresh"
            onPress={() => setSlot({ phase: 'idle' })}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs, alignItems: 'center' },
  heading: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  sub: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  list: { gap: spacing.md },
  empty: {
    textAlign: 'center',
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },

  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.sidebar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: colors.onBrand,
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.sm,
  },
  storeName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  storeMeta: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: 2 },

  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  downloadText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.brand,
  },

  statusBox: { gap: spacing.xs },
  statusText: { fontSize: fontSizes.sm, color: colors.text },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.brand },
  fileName: { fontSize: fontSizes.xs, color: colors.textFaint },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.dangerBg,
  },
  errorText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.danger,
  },

  confirm: { gap: spacing.sm },
  confirmTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.text,
  },
  dealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dealRowWarn: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
  },
  dealMain: { flex: 1 },
  dealLabel: { fontSize: fontSizes.sm, color: colors.text },
  dealRegular: { fontSize: fontSizes.xs, color: colors.textMuted },
  suspectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  suspectText: {
    flex: 1,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.warning,
  },
  priceInputWrapWarn: { borderColor: colors.warning },
  priceCol: { alignItems: 'flex-end', gap: 2 },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
  },
  dollar: { fontSize: fontSizes.sm, color: colors.textMuted },
  priceInput: {
    minWidth: 48,
    paddingVertical: 4,
    fontSize: fontSizes.sm,
    color: colors.text,
    textAlign: 'right',
  },
  perUnit: { fontSize: fontSizes.xs, color: colors.textMuted },
  warnText: { fontSize: fontSizes.xs, color: colors.warning },

  appliedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.successBg,
  },
  appliedText: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.success,
  },
});
