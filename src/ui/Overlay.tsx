import React from 'react';
import {
  Modal as RNModal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors, fontSizes, fontWeights, radii, shadow, spacing } from '@/theme/tokens';
import { Icon } from './Icon';

/**
 * Centered modal shell (used by the swap dialog).
 */
export function Modal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 520,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { maxWidth }]}
          onPress={(e) => e.stopPropagation()}
        >
          {title ? (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Icon name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={styles.modalBody}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

/**
 * Right-hand slide-over drawer (used by the preferences panel). On narrow
 * viewports it takes the full width.
 */
export function Drawer({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 440,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const { width: vw } = useWindowDimensions();
  const panelWidth = Math.min(width, vw);
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.drawerBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.drawerPanel, { width: panelWidth }]}
          onPress={(e) => e.stopPropagation()}
        >
          {title ? (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Icon name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView contentContainerStyle={styles.drawerBody}>{children}</ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.canvas,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadow.drawer,
  },
  modalBody: { padding: spacing.xl, gap: spacing.md },

  drawerBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawerPanel: {
    backgroundColor: colors.canvas,
    height: '100%',
    ...shadow.drawer,
  },
  drawerBody: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.text },
  subtitle: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: 2 },

  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
