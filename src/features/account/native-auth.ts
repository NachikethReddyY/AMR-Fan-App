import * as AuthSession from 'expo-auth-session';
import { privateStorage } from './storage';
import { createAccountApi } from './api';
import type { StoredSession } from './session';
import { parseStoredSession } from './stored-session';
import { createSupabaseAuth } from './supabase';

const dev = __DEV__;
export const localSignInEnabled =
  dev && process.env.EXPO_PUBLIC_LOCAL_SIGN_IN === 'true';
export const api = createAccountApi(process.env.EXPO_PUBLIC_API_URL ?? '', dev);
const storageKey = 'amr.account.session.v1';
export const storage = {
  read: async (): Promise<StoredSession | null> => {
    const raw = await privateStorage.read(storageKey);
    if (!raw) return null;
    return parseStoredSession(raw);
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

// The fixture origin is usable only in a development bundle and only on loopback.
// It never changes the trusted production project or sends real credentials.
const fixtureUrl = process.env.EXPO_PUBLIC_AUTH_FIXTURE_URL;
export const syntheticEmailAuth = dev && Boolean(fixtureUrl);
export const emailAuth = createSupabaseAuth({
  config: () => api.request('/admin/config'),
  development: dev,
  fixtureUrl,
});
export async function authenticateEmail(
  mode: 'signIn' | 'signUp',
  email: string,
  password: string,
) {
  const result =
    mode === 'signUp'
      ? await emailAuth.signUp(email, password)
      : {
          kind: 'session' as const,
          provider: await emailAuth.signIn(email, password),
        };
  if (result.kind === 'confirmation') return result;
  try {
    const session = await api.signIn(result.provider.accessToken);
    return { ...session, provider: result.provider };
  } catch (error) {
    await emailAuth.revoke(result.provider);
    throw error;
  }
}
