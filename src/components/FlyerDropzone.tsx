import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { UploadedFlyerFile } from '@/domain/types';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import {
  isFilePickSupported,
  pickFlyerFile,
  toUploadedFile,
} from '@/services/filePick';

/**
 * Click-to-pick + drag-and-drop flyer upload target. Web-only interactivity:
 * on native it renders a friendly "available on web for now" stub. NO top-level
 * DOM usage — the drag listeners are attached inside a Platform-guarded effect
 * against the View's underlying DOM node (react-native-web forwards the ref).
 */
export function FlyerDropzone({
  onFile,
  disabled = false,
  hint,
}: {
  onFile: (file: UploadedFlyerFile) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const supported = isFilePickSupported();
  const [dragActive, setDragActive] = useState(false);
  const ref = useRef<View | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || disabled) return;
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(true);
    };
    const onDragLeave = () => setDragActive(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) onFile(toUploadedFile(file));
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [onFile, disabled]);

  if (!supported) {
    return (
      <View style={[styles.zone, styles.stub]}>
        <Icon name="phone-portrait-outline" size={20} color={colors.textMuted} />
        <Text style={styles.stubText}>
          Flyer upload is available on the web app for now. Continue to plan with
          demo prices.
        </Text>
      </View>
    );
  }

  const onPress = async () => {
    if (disabled) return;
    const file = await pickFlyerFile();
    if (file) onFile(file);
  };

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Upload a flyer"
      style={[
        styles.zone,
        dragActive && styles.zoneActive,
        disabled && styles.zoneDisabled,
      ]}
    >
      <Icon name="cloud-upload-outline" size={24} color={colors.brand} />
      <Text style={styles.title}>Drop your flyer here, or click to browse</Text>
      <Text style={styles.sub}>{hint ?? 'PDF, PNG, or JPG'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zone: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSunken,
  },
  zoneActive: {
    borderColor: colors.brand,
    backgroundColor: colors.successBg,
  },
  zoneDisabled: { opacity: 0.5 },
  title: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  sub: { fontSize: fontSizes.xs, color: colors.textMuted },
  stub: { backgroundColor: colors.surfaceMuted, borderStyle: 'solid' },
  stubText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
