import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store has no web implementation, so the browser falls back to AsyncStorage.
const web = Platform.OS === 'web';

export const getSecret = (key: string): Promise<string | null> => (web ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key));
export const setSecret = (key: string, value: string): Promise<void> => (web ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value));
export const deleteSecret = (key: string): Promise<void> => (web ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key));
