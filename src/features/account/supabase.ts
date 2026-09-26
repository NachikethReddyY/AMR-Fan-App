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
export function validateConfirmation(email: string, code: string) {
  const address = validateEmail(email);
  const token = code.trim();
  if (!/^[0-9]{8}$/.test(token))
    throw new Error('Enter the 8-digit code from your email.');
  return { email: address, token, type: 'email' as const };
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
  let publicConfiguration: z.infer<typeof configuration> | undefined;
  async function send(path: string, body?: unknown, accessToken?: string) {
    // Keep only validated public configuration in memory. Provider logout must
    // remain possible if the app API becomes unavailable after sign-in.
    if (!publicConfiguration) {
      const parsed = configuration.safeParse(await config());
      if (!parsed.success)
        throw new Error('Email sign-in is not configured. Try again later.');
      publicConfiguration = parsed.data;
    }
    let response;
    try {
      response = await request(`${origin}/auth/v1/${path}`, {
        method: 'POST',
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
      throw new Error(
        'Account connection unavailable. Reconnect and try again.',
      );
    }
    if (
      response.redirected ||
      (response.url && new URL(response.url).origin !== origin)
    )
      throw new Error('Invalid sign-in response.');
    // Native fetch has no portable streaming reader. Reject an advertised large
    // body before reading, then enforce the same bound on decoded text.
    if (Number(response.headers.get('content-length')) > 65536)
      throw new Error('Invalid sign-in response.');
    const text = await response.text();
    if (text.length > 65536) throw new Error('Invalid sign-in response.');
    let value: unknown = null;
    try {
      value = text ? JSON.parse(text) : null;
    } catch {
      throw new Error('Invalid sign-in response.');
    }
    if (!response.ok) {
      const code = z.object({ error_code: z.string() }).safeParse(value);
      if (response.status === 429)
        throw new Error('Too many attempts. Wait a moment and try again.');
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
      if (path === 'verify')
        throw new Error(
          [400, 401, 403].includes(response.status)
            ? 'The code is invalid or expired. Request a new code and try again.'
            : 'Could not confirm your email. Try again in a moment.',
        );
      if (path === 'resend')
        throw new Error(
          'Could not resend the code. Wait a moment and try again.',
        );
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
  return {
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
    verifyCode: async (email: string, code: string) =>
      parse(await send('verify', validateConfirmation(email, code))),
    resendCode: async (email: string): Promise<void> => {
      await send('resend', { email: validateEmail(email), type: 'signup' });
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
