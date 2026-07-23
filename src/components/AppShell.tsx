import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors, NARROW_BREAKPOINT } from '@/theme/tokens';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

/**
 * Responsive app shell: dark-green sidebar on the left (full at >= breakpoint,
 * icon-rail when narrow) + light header on top, with the routed screen filling
 * the rest.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const narrow = width < NARROW_BREAKPOINT;

  return (
    <View style={styles.root}>
      <Sidebar collapsed={narrow} />
      <View style={styles.main}>
        <Header narrow={narrow} />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.canvas },
  main: { flex: 1 },
  content: { flex: 1 },
});
