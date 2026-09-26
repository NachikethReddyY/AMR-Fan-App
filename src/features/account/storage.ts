import * as SecureStore from 'expo-secure-store';
export const privateStorage = {
  read: (key: string) => SecureStore.getItemAsync(key),
  write: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  clear: (key: string) => SecureStore.deleteItemAsync(key),
};
