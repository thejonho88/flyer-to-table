import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin key/value wrapper over AsyncStorage (which is backed by localStorage on
 * web and native storage on device). This is the single seam that a Supabase
 * adapter would later replace — nothing else in the app touches storage APIs
 * directly.
 */
export const kv = {
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async setJSON<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // best-effort; local persistence failures should not crash the app
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
