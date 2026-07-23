import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * Opens an external URL (e.g. a store's weekly flyer page). Platform-guarded so
 * it stays RN-portable, mirroring the guard pattern in services/share.ts:
 *  - web: window.open in a new tab with noopener/noreferrer (no opener leak),
 *  - native: expo-linking's openURL.
 * Returns whether the open was dispatched; never throws.
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false;
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
    return false;
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
