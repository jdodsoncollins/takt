import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { MemoryTokenStore, type TokenStore } from './tokenStore';

/**
 * SecureStore on iOS/Android; memory on web (dev smoke only).
 * Never use memory store for production native builds.
 */
export function createPlatformTokenStore(): TokenStore {
  if (Platform.OS === 'web') {
    return new MemoryTokenStore();
  }
  return {
    async save(key: string, value: string): Promise<void> {
      await SecureStore.setItemAsync(key, value);
    },
    async load(key: string): Promise<string | null> {
      return SecureStore.getItemAsync(key);
    },
    async delete(key: string): Promise<void> {
      await SecureStore.deleteItemAsync(key);
    },
  };
}
