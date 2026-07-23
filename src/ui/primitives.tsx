import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fontSizes, fontWeights, radii, shadow, spacing } from '@/theme/tokens';
import { Icon, IconName } from './Icon';

/* ----------------------------- Card ----------------------------- */

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}) {
  return (
    <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>
  );
}

/* ---------------------------- Button ---------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  fullWidth,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.brand, fg: colors.onBrand },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.brand },
    danger: { bg: colors.danger, fg: colors.onBrand },
  };
  const p = palette[variant];
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: p.bg },
        p.border ? { borderWidth: 1, borderColor: p.border } : null,
        fullWidth && { alignSelf: 'stretch' },
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Icon name={icon} size={16} color={p.fg} /> : null}
          <Text style={[styles.buttonLabel, { color: p.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ----------------------------- Chip ----------------------------- */

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipIdle,
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon ? (
        <Icon name={icon} size={14} color={selected ? colors.brand : colors.textMuted} />
      ) : null}
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? colors.brand : colors.textMuted },
          selected && { fontWeight: fontWeights.semibold },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Read-only info chip (e.g. "3 stores"). */
export function InfoChip({ label, icon }: { label: string; icon?: IconName }) {
  return (
    <View style={[styles.chip, styles.chipIdle]}>
      {icon ? <Icon name={icon} size={14} color={colors.textMuted} /> : null}
      <Text style={[styles.chipLabel, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

/* ---------------------------- Badge ----------------------------- */

export function Badge({
  label,
  tone = 'success',
}: {
  label: string;
  tone?: 'success' | 'neutral';
}) {
  const bg = tone === 'success' ? colors.successBg : colors.surfaceMuted;
  const fg = tone === 'success' ? colors.success : colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeLabel, { color: fg }]}>{label}</Text>
    </View>
  );
}

/* ---------------------------- Stepper --------------------------- */

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 12,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={styles.stepperBtn}
        accessibilityLabel="Decrease"
      >
        <Icon name="remove" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.stepperValue}>
        {value}
        {suffix ? <Text style={styles.stepperSuffix}> {suffix}</Text> : null}
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        style={styles.stepperBtn}
        accessibilityLabel="Increase"
      >
        <Icon name="add" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

/* ------------------------ Segmented slider ---------------------- */

export function SegmentedSlider<T>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmentWrap}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: active ? colors.brand : colors.textMuted },
                active && { fontWeight: fontWeights.bold },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ----------------------------- Toggle --------------------------- */

export function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.toggle, { backgroundColor: value ? colors.brand : colors.borderStrong }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : styles.toggleKnobOff]} />
    </Pressable>
  );
}

/* ---------------------------- Checkbox -------------------------- */

export function Checkbox({
  checked,
  onPress,
}: {
  checked: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Icon name="checkmark" size={14} color={colors.onBrand} /> : null}
      </View>
    </Pressable>
  );
}

/* --------------------------- Text input ------------------------- */

export function Field({
  icon,
  style,
  ...props
}: TextInputProps & { icon?: IconName }) {
  return (
    <View style={styles.field}>
      {icon ? <Icon name={icon} size={18} color={colors.textMuted} /> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.fieldInput, style]}
        {...props}
      />
    </View>
  );
}

/* ------------------------- Skeleton card ------------------------ */

export function SkeletonCard({ height = 120 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}

export function SkeletonLine({ width = '60%' }: { width?: number | `${number}%` }) {
  return <View style={[styles.skeletonLine, { width }]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardPadded: { padding: spacing.lg },

  button: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonLabel: { fontSize: fontSizes.md, fontWeight: fontWeights.bold },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.successBg, borderColor: colors.brand },
  chipLabel: { fontSize: fontSizes.sm },

  badge: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.text, minWidth: 40, textAlign: 'center' },
  stepperSuffix: { fontSize: fontSizes.sm, fontWeight: fontWeights.regular, color: colors.textMuted },

  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, paddingVertical: spacing.sm, borderRadius: radii.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface, ...shadow.card },
  segmentLabel: { fontSize: fontSizes.sm },

  toggle: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface },
  toggleKnobOn: { alignSelf: 'flex-end' },
  toggleKnobOff: { alignSelf: 'flex-start' },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  fieldInput: { flex: 1, fontSize: fontSizes.md, color: colors.text, paddingVertical: spacing.md },

  skeleton: { backgroundColor: colors.skeleton, borderRadius: radii.lg },
  skeletonLine: { height: 12, backgroundColor: colors.skeleton, borderRadius: radii.sm, marginTop: spacing.sm },
});
