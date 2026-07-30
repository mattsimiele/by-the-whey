import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const APPLE_USER_ID_KEY = 'bythewhey.apple-user-id';

export const storeAppleUserId = async (userId: string) => {
  if (Platform.OS !== 'ios' || !userId) return;
  await SecureStore.setItemAsync(APPLE_USER_ID_KEY, userId);
};

export const clearAppleUserId = async () => {
  if (Platform.OS !== 'ios') return;
  await SecureStore.deleteItemAsync(APPLE_USER_ID_KEY);
};

export const getStoredAppleCredentialState = async (fallbackUserId?: string) => {
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) return null;
  let appleUserId = await SecureStore.getItemAsync(APPLE_USER_ID_KEY);
  if (!appleUserId && fallbackUserId) {
    appleUserId = fallbackUserId;
    await storeAppleUserId(fallbackUserId);
  }
  if (!appleUserId) return null;
  return AppleAuthentication.getCredentialStateAsync(appleUserId);
};
