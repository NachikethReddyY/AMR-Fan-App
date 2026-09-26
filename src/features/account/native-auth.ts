import * as AuthSession from 'expo-auth-session';
import { privateStorage } from './storage';
import { createAccountApi } from './api';
import type { StoredSession } from './session';

const dev = __DEV__;
export const localSignInEnabled =
  dev && process.env.EXPO_PUBLIC_LOCAL_SIGN_IN === 'true';
export const api = createAccountApi(process.env.EXPO_PUBLIC_API_URL ?? '', dev);
const storageKey = 'amr.account.session.v1';
export const storage = {
  read: async (): Promise<StoredSession | null> => {
    const raw = await privateStorage.read(storageKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === 'object' &&
      'kind' in value &&
      'token' in value &&
      typeof value.token === 'string'
    ) {
      if (value.kind === 'revoking')
        return { kind: 'revoking', token: value.token };
      if (
        value.kind === 'active' &&
        'selected' in value &&
        (value.selected === 'real' || value.selected === 'demo')
      )
        return { kind: 'active', token: value.token, selected: value.selected };
    }
    throw new Error('Stored sign-in could not be read.');
  },
  write: async (value: StoredSession) =>
    privateStorage.write(storageKey, JSON.stringify(value)),
  clear: async () => privateStorage.clear(storageKey),
};
export async function signInWithProvider() {
  const issuer = process.env.EXPO_PUBLIC_AUTH_ISSUER;
  const clientId = process.env.EXPO_PUBLIC_AUTH_CLIENT_ID;
  const scope = process.env.EXPO_PUBLIC_AUTH_API_SCOPE;
  const redirectUri = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URI;
  if (!issuer || !clientId || !scope || !redirectUri)
    throw new Error('Email sign-in is awaiting provider setup.');
  const issuerUrl = new URL(issuer);
  if (
    issuerUrl.protocol !== 'https:' ||
    issuerUrl.username ||
    issuerUrl.password
  )
    throw new Error('Sign-in configuration is invalid.');
  const discovery = await AuthSession.fetchDiscoveryAsync(issuer);
  for (const endpoint of [
    discovery.authorizationEndpoint,
    discovery.tokenEndpoint,
  ]) {
    if (!endpoint || new URL(endpoint).protocol !== 'https:')
      throw new Error('Secure sign-in is unavailable.');
  }
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    scopes: ['openid', 'email', scope],
    extraParams: { prompt: 'select_account' },
  });
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success')
    throw new Error(
      result.type === 'cancel' || result.type === 'dismiss'
        ? 'Sign-in cancelled.'
        : 'Sign-in failed. Try again.',
    );
  if (!request.codeVerifier || !result.params.code)
    throw new Error('Sign-in could not be completed.');
  const tokens = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      redirectUri,
      code: result.params.code,
      extraParams: { code_verifier: request.codeVerifier },
    },
    discovery,
  );
  return api.signIn(tokens.accessToken);
}
