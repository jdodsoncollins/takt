import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from './kvStore';

export class AsyncStorageKeyValueStore implements KeyValueStore {
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  async getAllKeys(): Promise<string[]> {
    return [...(await AsyncStorage.getAllKeys())];
  }
}

export function createAppKeyValueStore(): KeyValueStore {
  return new AsyncStorageKeyValueStore();
}
