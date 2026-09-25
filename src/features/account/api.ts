import { parseHistoryPage } from '../points/contracts.ts';

export type Profile = {
  id: string;
  kind: 'real' | 'demo';
  displayName: string;
  balance: number;
};
export type Account = {
  id: string;
  role: 'fan' | 'admin';
  profiles: Profile[];
};
export type Session = { token: string; expiresAt: string; account: Account };
export class AccountError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid server response.');
  return Object.fromEntries(Object.entries(value));
}
function profile(value: unknown): Profile {
  const p = object(value);
  if (
    typeof p.id !== 'string' ||
    (p.kind !== 'real' && p.kind !== 'demo') ||
    typeof p.displayName !== 'string' ||
    typeof p.balance !== 'number' ||
    !Number.isSafeInteger(p.balance) ||
    p.balance < 0
  )
    throw new Error('Invalid profile response.');
  return {
    id: p.id,
    kind: p.kind,
    displayName: p.displayName,
    balance: p.balance,
  };
}
function account(value: unknown): Account {
  const a = object(value);
  if (
    typeof a.id !== 'string' ||
    (a.role !== 'fan' && a.role !== 'admin') ||
    !Array.isArray(a.profiles)
  )
    throw new Error('Invalid account response.');
  const profiles = a.profiles.map(profile);
  if (profiles.length !== 2 || new Set(profiles.map((p) => p.kind)).size !== 2)
    throw new Error('Invalid account profiles.');
  return { id: a.id, role: a.role, profiles };
}
function session(value: unknown): Session {
  const s = object(value);
  if (
    typeof s.token !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(s.token) ||
    typeof s.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(s.expiresAt))
  )
    throw new Error('Invalid session response.');
  return {
    token: s.token,
    expiresAt: s.expiresAt,
    account: account(s.account),
  };
}
export function createAccountApi(baseUrl: string, development: boolean) {
  let base: URL | null = null;
  if (baseUrl) {
    base = new URL(baseUrl);
    if (
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== '/' ||
      (base.protocol !== 'https:' &&
        !(
          development &&
          base.protocol === 'http:' &&
          ['127.0.0.1', 'localhost', '10.0.2.2'].includes(base.hostname)
        ))
    )
      throw new Error('Use an HTTPS API URL, or a local development API.');
  }
  async function request(
    path: string,
    token?: string,
    method = 'GET',
    body?: unknown,
  ): Promise<unknown> {
    if (!base) throw new Error('Sign-in is not configured on this build.');
    const response = await fetch(new URL(path, base).href, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new AccountError(
        response.status,
        response.status === 401
          ? 'Your session expired. Sign in again.'
          : 'Could not complete the request. Try again.',
      );
    return response.json();
  }
  return {
    signIn: async (accessToken: string) =>
      session(await request('/v1/session', accessToken, 'POST')),
    syntheticSignIn: async (fixture: 'fan-a' | 'fan-b') => {
      if (!development) throw new Error('Local sign-in is unavailable.');
      return session(
        await request('/v1/dev/session', undefined, 'POST', { fixture }),
      );
    },
    resume: async (token: string) => account(await request('/v1/me', token)),
    logout: async (token: string) => {
      await request('/v1/session', token, 'DELETE');
    },
    rename: async (token: string, id: string, displayName: string) =>
      profile(
        await request(
          `/v1/profiles/${encodeURIComponent(id)}`,
          token,
          'PATCH',
          { displayName },
        ),
      ),
    history: async (token: string, id: string, before?: string) => {
      const query = new URLSearchParams({ limit: '25' });
      if (before) query.set('before', before);
      return parseHistoryPage(
        await request(
          `/v1/profiles/${encodeURIComponent(id)}/points/history?${query}`,
          token,
        ),
        id,
      );
    },
  };
}
export type AccountApi = ReturnType<typeof createAccountApi>;
