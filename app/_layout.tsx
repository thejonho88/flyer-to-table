import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, fontSizes, fontWeights, spacing } from '@/theme/tokens';
import { useBootstrap } from '@/state/bootstrap';

export default function RootLayout() {
  const ready = useBootstrap();

  if (!ready) {
    return (
      <View style={styles.splash}>
        <View style={styles.logo} />
        <Text style={styles.brand}>Flyer to Table</Text>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.canvas,
  },
  logo: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.brand },
  brand: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.text },
});
