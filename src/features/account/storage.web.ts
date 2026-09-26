// Local synthetic web proof only. Native builds resolve storage.ts/SecureStore.
function localStorageForProof() {
  if (
    !__DEV__ ||
    process.env.EXPO_PUBLIC_LOCAL_SIGN_IN !== 'true' ||
    !['127.0.0.1', 'localhost'].includes(globalThis.location.hostname)
  )
    throw new Error('Fan web sign-in is not available in this build.');
  return globalThis.sessionStorage;
}
export const privateStorage = {
  read: async (key: string) => localStorageForProof().getItem(key),
  write: async (key: string, value: string) =>
    localStorageForProof().setItem(key, value),
  clear: async (key: string) => localStorageForProof().removeItem(key),
};
