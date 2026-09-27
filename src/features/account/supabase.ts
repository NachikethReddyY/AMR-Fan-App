import { z } from 'zod';
import { AccountError } from './api.ts';

export const supabaseOrigin = 'https://folakoxsilrfemctvlxj.supabase.co';
export const providerSessionSchema = z.object({
  accessToken: z.string().min(1).max(16384),
  refreshToken: z.string().min(1).max(4096),
  expiresAt: z.number().int().positive().safe(),
  subject: z.uuid(),
});
export type ProviderSession = z.infer<typeof providerSessionSchema>;
const accountDetailsSchema = z.object({
  id: z.uuid(),
  email: z.email().max(254),
  new_email: z.union([z.email().max(254), z.literal('')]).optional(),
});
export type AccountDetails = { email: string; pendingEmail: string | null };
export type AccountChange =
  | { kind: 'email'; email: string }
  | {
      kind: 'password';
      password: string;
      currentPassword: string;
      nonce?: string;
    };
export class AccountEditError extends Error {
  constructor(
    public readonly kind:
      'reauthenticationRequired' | 'signInRequired' | 'failed',
    message: string,
  ) {
    super(message);
  }
}
const tokenResponse = z.object({
  access_token: z.string().min(1).max(16384),
  refresh_token: z.string().min(1).max(4096),
  expires_in: z.number().int().positive().max(86400),
  token_type: z.literal('bearer'),
  user: z.object({ id: z.uuid() }),
});
const configuration = z.object({
  auth: z.object({
    mode: z.literal('supabase'),
    url: z.literal(supabaseOrigin),
    publishableKey: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]{16,200}$/),
  }),
});
export class EmailConfirmationRequired extends Error {
  constructor() {
    super('Confirm your email before signing in.');
  }
}
export function validateEmail(email: string) {
  const parsed = z.email().max(254).safeParse(email.trim());
  if (!parsed.success) throw new Error('Enter a valid email address.');
  return parsed.data;
}
export function validateCredentials(email: string, password: string) {
  const address = validateEmail(email);
  if (!password || password.length > 1024)
    throw new Error('Enter a password of at most 1,024 characters.');
  return { email: address, password };
}
export function createSupabaseAuth({
  config,
  request = fetch,
  now = Date.now,
  development = false,
  fixtureUrl,
}: {
  config: () => Promise<unknown>;
  request?: typeof fetch;
  now?: () => number;
  development?: boolean;
  fixtureUrl?: string;
}) {
  let origin = supabaseOrigin;
  if (fixtureUrl) {
    const url = new URL(fixtureUrl);
    if (
      !development ||
      url.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost', '10.0.2.2'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error(
        'Synthetic authentication requires a development loopback fixture.',
      );
    origin = url.origin;
  }
  function uncertainUpdate() {
    return new AccountEditError(
      'failed',
      'Could not confirm the update. Check your email or sign in with your new details before retrying.',
    );
  }
  let publicConfiguration: z.infer<typeof configuration> | undefined;
  async function send(
    path: string,
    body?: unknown,
    accessToken?: string,
    method: 'POST' | 'GET' | 'PUT' = 'POST',
    beforeSend?: () => void,
  ) {
    // Keep only validated public configuration in memory. Provider logout must
    // remain possible if the app API becomes unavailable after sign-in.
    if (!publicConfiguration) {
      const parsed = configuration.safeParse(await config());
      if (!parsed.success)
        throw new Error('Email sign-in is not configured. Try again later.');
      publicConfiguration = parsed.data;
    }
    // Configuration may have awaited I/O after the controller checked identity.
    beforeSend?.();
    let response;
    try {
      response = await request(`${origin}/auth/v1/${path}`, {
        method,
        headers: {
          apikey: publicConfiguration.auth.publishableKey,
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch {
      if (method === 'PUT') throw uncertainUpdate();
      throw new Error(
        'Account connection unavailable. Reconnect and try again.',
      );
    }
    let value: unknown = null;
    try {
      if (
        response.redirected ||
        (response.url && new URL(response.url).origin !== origin)
      )
        throw new Error('Invalid response');
      // Native fetch has no portable streaming reader. Bound advertised and decoded bodies.
      if (Number(response.headers.get('content-length')) > 65536)
        throw new Error('Invalid response');
      const text = await response.text();
      if (text.length > 65536) throw new Error('Invalid response');
      value = text ? JSON.parse(text) : null;
    } catch {
      if (method === 'PUT') throw uncertainUpdate();
      throw new Error('Invalid sign-in response.');
    }
    if (!response.ok) {
      const code = z.object({ error_code: z.string() }).safeParse(value);
      if (response.status === 429)
        throw new Error('Too many attempts. Wait a moment and try again.');
      if (path === 'user' || path === 'reauthenticate') {
        const errorCode = code.success ? code.data.error_code : '';
        if (errorCode === 'reauthentication_needed')
          throw new AccountEditError(
            'reauthenticationRequired',
            'Confirm it is you before changing your password. Send a code, then enter it below.',
          );
        if (errorCode === 'reauthentication_not_valid')
          throw new AccountEditError(
            'reauthenticationRequired',
            'That code is invalid or expired. Send a new code and try again.',
          );
        if (
          errorCode === 'current_password_required' ||
          errorCode === 'current_password_mismatch'
        )
          throw new AccountEditError(
            'failed',
            'Check your current password and try again.',
          );
        if (errorCode === 'same_password')
          throw new AccountEditError(
            'failed',
            'Choose a different new password.',
          );
        if (errorCode === 'weak_password')
          throw new AccountEditError(
            'failed',
            'Choose a stronger password and try again.',
          );
        if (
          errorCode === 'email_exists' ||
          errorCode === 'email_address_invalid'
        )
          throw new AccountEditError(
            'failed',
            'That email cannot be used. Check it or choose another.',
          );
        if (errorCode === 'insufficient_aal')
          throw new AccountEditError(
            'failed',
            'This account requires additional verification. Complete it with your account provider before retrying.',
          );
        if (
          response.status === 401 ||
          errorCode === 'session_not_found' ||
          errorCode === 'refresh_token_not_found'
        )
          throw new AccountEditError(
            'signInRequired',
            'Your sign-in expired. Sign in again before editing your account.',
          );
        throw new AccountEditError(
          'failed',
          'Could not update account details. Check your connection and try again.',
        );
      }
      if (code.success && code.data.error_code === 'email_not_confirmed')
        throw new EmailConfirmationRequired();
      if (
        path.startsWith('token?grant_type=refresh_token') &&
        [400, 401, 403].includes(response.status)
      )
        throw new AccountError(401, 'Your sign-in expired. Sign in again.');
      if (
        path.startsWith('logout') &&
        [401, 403, 404].includes(response.status)
      )
        throw new AccountError(401, 'Provider session is no longer available.');
      if (path === 'signup')
        throw new Error(
          'Could not create an account. Check your details and password requirements, then try again.',
        );
      throw new Error('Sign-in failed. Check your email and password.');
    }
    return value;
  }
  function parse(value: unknown): ProviderSession {
    const result = tokenResponse.safeParse(value);
    if (!result.success) throw new Error('Invalid sign-in response.');
    const t = result.data;
    return providerSessionSchema.parse({
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: now() + t.expires_in * 1000,
      subject: t.user.id,
    });
  }
  async function refresh(session: ProviderSession) {
    const next = parse(
      await send('token?grant_type=refresh_token', {
        refresh_token: session.refreshToken,
      }),
    );
    if (next.subject !== session.subject)
      throw new AccountError(401, 'Your sign-in changed. Sign in again.');
    return next;
  }
  function details(
    value: unknown,
    session: ProviderSession,
    updating = false,
  ): AccountDetails {
    const parsed = accountDetailsSchema.safeParse(value);
    if (!parsed.success) {
      if (updating) throw uncertainUpdate();
      throw new Error('Invalid account response. Try again.');
    }
    if (parsed.data.id !== session.subject)
      throw new AccountEditError(
        'signInRequired',
        'Account identity changed. Sign in again.',
      );
    return {
      email: parsed.data.email,
      pendingEmail: parsed.data.new_email || null,
    };
  }
  return {
    account: {
      read: async (session: ProviderSession, beforeSend?: () => void) =>
        details(
          await send('user', undefined, session.accessToken, 'GET', beforeSend),
          session,
        ),
      update: async (
        session: ProviderSession,
        change: AccountChange,
        beforeSend?: () => void,
      ) => {
        let body;
        if (change.kind === 'email') {
          body = { email: validateEmail(change.email) };
        } else {
          if (
            !change.password ||
            change.password.length > 1024 ||
            !change.currentPassword ||
            change.currentPassword.length > 1024
          )
            throw new Error(
              'Enter your current and new passwords, each at most 1,024 characters.',
            );
          if (change.nonce !== undefined && !/^\d{6,10}$/.test(change.nonce))
            throw new Error('Enter the verification code from your email.');
          body = {
            password: change.password,
            current_password: change.currentPassword,
            ...(change.nonce ? { nonce: change.nonce } : {}),
          };
        }
        const updated = details(
          await send('user', body, session.accessToken, 'PUT', beforeSend),
          session,
          true,
        );
        if (change.kind === 'email') {
          const requested = validateEmail(change.email).toLowerCase();
          if (
            updated.email.toLowerCase() !== requested &&
            updated.pendingEmail?.toLowerCase() !== requested
          )
            throw new AccountEditError(
              'failed',
              'Could not confirm the email change. Check your account email before retrying.',
            );
        }
        return updated;
      },
      reauthenticate: async (
        session: ProviderSession,
        beforeSend?: () => void,
      ) => {
        // Auth's router and official JS client use GET; its OpenAPI lists POST.
        await send(
          'reauthenticate',
          undefined,
          session.accessToken,
          'GET',
          beforeSend,
        );
      },
    },
    signIn: async (email: string, password: string) =>
      parse(
        await send(
          'token?grant_type=password',
          validateCredentials(email, password),
        ),
      ),
    signUp: async (
      email: string,
      password: string,
    ): Promise<
      | { kind: 'confirmation'; email: string }
      | { kind: 'session'; provider: ProviderSession }
    > => {
      const value = await send('signup', validateCredentials(email, password));
      if (value && typeof value === 'object' && 'access_token' in value)
        return { kind: 'session', provider: parse(value) };
      if (!z.object({ id: z.uuid() }).safeParse(value).success)
        throw new Error('Invalid sign-up response.');
      return { kind: 'confirmation', email: validateEmail(email) };
    },
    refresh,
    revoke: async (session: ProviderSession) => {
      let current = session;
      if (current.expiresAt <= now()) {
        try {
          current = await refresh(current);
        } catch (error) {
          if (error instanceof AccountError && error.status === 401) return;
          throw error;
        }
      }
      try {
        await send('logout?scope=local', undefined, current.accessToken);
      } catch (error) {
        if (!(error instanceof AccountError && error.status === 401))
          throw error;
        try {
          current = await refresh(current);
        } catch (refreshError) {
          if (
            refreshError instanceof AccountError &&
            refreshError.status === 401
          )
            return;
          throw refreshError;
        }
        await send('logout?scope=local', undefined, current.accessToken);
      }
    },
  };
}
