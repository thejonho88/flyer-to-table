import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme/tokens';
import { Icon, IconName } from '@/ui/Icon';
import { usePlanStore } from '@/state/planStore';

interface NavItem {
  label: string;
  icon: IconName;
  route: '/home' | '/meal-plan' | '/shopping-list' | '/settings';
}

const NAV: NavItem[] = [
  { label: 'Home', icon: 'home-outline', route: '/home' },
  { label: 'Meal Plan', icon: 'calendar-outline', route: '/meal-plan' },
  { label: 'Shopping List', icon: 'cart-outline', route: '/shopping-list' },
  { label: 'Settings', icon: 'options-outline', route: '/settings' },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const generate = usePlanStore((s) => s.generate);

  const onGenerate = async () => {
    await generate();
    router.push('/home');
  };

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      <View style={[styles.brand, collapsed && styles.brandCollapsed]}>
        <View style={styles.logo}>
          <Icon name="leaf" size={18} color={colors.onBrand} />
        </View>
        {!collapsed ? <Text style={styles.brandText}>Flyer to Table</Text> : null}
      </View>

      <View style={styles.nav}>
        {NAV.map((item) => {
          const active =
            pathname === item.route ||
            (item.route === '/home' && pathname === '/');
          return (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route)}
              style={[
                styles.navItem,
                collapsed && styles.navItemCollapsed,
                active && styles.navItemActive,
              ]}
            >
              <Icon
                name={item.icon}
                size={20}
                color={active ? colors.onBrand : colors.sidebarText}
              />
              {!collapsed ? (
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {item.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bottom}>
        <Pressable onPress={onGenerate} style={[styles.generate, collapsed && styles.generateCollapsed]}>
          {collapsed ? (
            <Icon name="sparkles" size={20} color={colors.onBrand} />
          ) : (
            <Text style={styles.generateLabel}>Generate Meal Plan</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: colors.sidebar,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    justifyContent: 'flex-start',
  },
  sidebarCollapsed: { width: 72, paddingHorizontal: spacing.sm, alignItems: 'center' },

  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxl, paddingHorizontal: spacing.sm },
  brandCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  logo: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { color: colors.onBrand, fontSize: fontSizes.lg, fontWeight: fontWeights.bold },

  nav: { gap: spacing.xs },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  navItemCollapsed: { justifyContent: 'center', paddingHorizontal: 0, width: 48 },
  navItemActive: { backgroundColor: colors.sidebarActive },
  navLabel: { color: colors.sidebarText, fontSize: fontSizes.md, fontWeight: fontWeights.medium },
  navLabelActive: { color: colors.onBrand, fontWeight: fontWeights.semibold },

  bottom: { marginTop: 'auto' },
  generate: {
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  generateCollapsed: { width: 48, height: 48, justifyContent: 'center' },
  generateLabel: { color: colors.onBrand, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
});
