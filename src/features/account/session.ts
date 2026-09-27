import {
  AccountError,
  type Account,
  type AccountApi,
  type Session,
} from './api.ts';
import type {
  AccountChange,
  AccountDetails,
  ProviderSession,
} from './supabase.ts';
export type AuthenticatedSession = Session & { provider?: ProviderSession };
export type ProviderLifecycle = {
  refresh: (session: ProviderSession) => Promise<ProviderSession>;
  revoke: (session: ProviderSession) => Promise<void>;
  account?: {
    read: (session: ProviderSession) => Promise<AccountDetails>;
    update: (
      session: ProviderSession,
      change: AccountChange,
    ) => Promise<AccountDetails>;
    reauthenticate: (session: ProviderSession) => Promise<void>;
  };
};
export type StoredSession =
  | {
      kind: 'active';
      token: string;
      selected: 'real' | 'demo';
      provider?: ProviderSession;
    }
  | { kind: 'revoking'; token: string; provider?: ProviderSession };
type Storage = {
  read: () => Promise<StoredSession | null>;
  write: (value: StoredSession) => Promise<void>;
  clear: () => Promise<void>;
};
export type SessionState =
  | { kind: 'loading' }
  | { kind: 'signedOut'; error: string | null }
  | { kind: 'unavailable'; message: string }
  | {
      kind: 'signedIn';
      account: Account;
      token: string;
      selected: 'real' | 'demo';
    };

export function createSessionController(
  api: AccountApi,
  storage: Storage,
  provider?: ProviderLifecycle,
) {
  let state: SessionState = { kind: 'loading' };
  let generation = 0;
  let authenticationGeneration: number | null = null;
  let storageQueue = Promise.resolve();
  // SecureStore writes cannot be cancelled. Serialize reads/mutations so an old
  // completion or cleanup cannot overwrite a newer persisted credential.
  function withStorage<T>(operation: () => Promise<T>): Promise<T> {
    const result = storageQueue.then(operation);
    storageQueue = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  const identityListeners = new Set<() => void>();
  const invalidateIdentity = () =>
    identityListeners.forEach((listener) => listener());
  const listeners = new Set<() => void>();
  const set = (next: SessionState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function clear(attempt: number, next: SessionState) {
    await withStorage(async () => {
      if (attempt !== generation) return;
      await storage.clear();
      if (attempt === generation) set(next);
    });
  }
  async function revokeToken(token: string) {
    try {
      await api.logout(token);
    } catch (error) {
      if (!(error instanceof AccountError && error.status === 401)) throw error;
    }
  }
  async function revokeCredentials(session: {
    token: string;
    provider?: ProviderSession;
  }) {
    const results = await Promise.allSettled([
      revokeToken(session.token),
      (async () => {
        if (!session.provider) return;
        if (!provider) throw new Error('Provider sign-out is unavailable.');
        await provider.revoke(session.provider);
      })(),
    ]);
    if (results.some((result) => result.status === 'rejected'))
      throw new Error('Remote sign-out could not be confirmed.');
  }
  async function revoke(session: StoredSession, attempt: number) {
    let error: string | null = null;
    try {
      await revokeCredentials(session);
    } catch {
      error =
        'Signed out on this device. Remote sign-out could not be confirmed.';
    }
    // Local logout never retains reusable credentials after a remote failure.
    // A crash during I/O retains only a non-resumable revocation intent.
    await clear(attempt, { kind: 'signedOut', error });
  }
  async function resume() {
    const attempt = ++generation;
    set({ kind: 'loading' });
    try {
      const stored = await withStorage(() => storage.read());
      if (attempt !== generation) return;
      if (!stored) return set({ kind: 'signedOut', error: null });
      if (stored.kind === 'revoking') return await revoke(stored, attempt);
      const account = await api.resume(stored.token);
      // Never renew an API401: only refresh the provider after the server has
      // confirmed the existing app session. Rotate privately within the same
      // storage queue so a waiting logout reads the newest refresh credential.
      const credentials = stored.provider;
      if (credentials && credentials.expiresAt <= Date.now() + 60000) {
        await withStorage(async () => {
          if (attempt !== generation) return;
          if (!provider) throw new Error('Provider refresh is unavailable.');
          const next = await provider.refresh(credentials);
          try {
            await storage.write({ ...stored, provider: next });
          } catch (error) {
            await provider.revoke(next);
            throw error;
          }
        });
      }
      if (attempt === generation)
        set({
          kind: 'signedIn',
          account,
          token: stored.token,
          selected: stored.selected,
        });
    } catch (error) {
      if (attempt !== generation) return;
      if (error instanceof AccountError && error.status === 401) {
        invalidateIdentity();
        try {
          await clear(attempt, { kind: 'signedOut', error: error.message });
          return;
        } catch {
          // Keep authority hidden when secure storage cannot be cleared.
        }
      }
      if (attempt === generation)
        set({
          kind: 'unavailable',
          message:
            'Account connection unavailable. Retry to resume or finish signing out.',
        });
    }
  }
  async function signIn(authenticate: () => Promise<AuthenticatedSession>) {
    invalidateIdentity();
    const attempt = ++generation;
    authenticationGeneration = attempt;
    set({ kind: 'loading' });
    try {
      const session = await authenticate();
      if (attempt !== generation) {
        await revokeCredentials(session);
        return;
      }
      let published;
      try {
        published = await withStorage(async () => {
          if (attempt !== generation) return false;
          try {
            await storage.write({
              kind: 'active',
              token: session.token,
              selected: 'real',
              ...(session.provider ? { provider: session.provider } : {}),
            });
          } catch (error) {
            // A rejected storage call may still have changed the stored value.
            await storage.clear();
            throw error;
          }
          if (attempt !== generation) {
            await storage.clear();
            return false;
          }
          set({
            kind: 'signedIn',
            account: session.account,
            token: session.token,
            selected: 'real',
          });
          return true;
        });
      } catch (error) {
        await revokeCredentials(session);
        throw error;
      }
      if (!published) await revokeCredentials(session);
    } catch (error) {
      if (attempt === generation)
        set({
          kind: 'signedOut',
          error:
            error instanceof Error
              ? error.message
              : 'Sign-in failed. Try again.',
        });
    } finally {
      if (authenticationGeneration === attempt) authenticationGeneration = null;
    }
  }
  async function logout() {
    invalidateIdentity();
    const attempt = ++generation;
    set({ kind: 'loading' });
    try {
      // Persist revocation intent before network I/O so offline restarts cannot resume.
      const token = await withStorage(async () => {
        if (attempt !== generation) return null;
        const stored = await storage.read();
        if (attempt !== generation) return null;
        if (!stored) {
          set({ kind: 'signedOut', error: null });
          return null;
        }
        const pending: StoredSession = {
          kind: 'revoking',
          token: stored.token,
          ...(stored.provider ? { provider: stored.provider } : {}),
        };
        try {
          await storage.write(pending);
        } catch {
          // A failed intent write must not skip either remote revocation.
          // Clear now if possible; the final generation-safe clear retries it.
          await storage.clear().catch(() => {});
        }
        return pending;
      });
      if (token) await revoke(token, attempt);
    } catch {
      try {
        await clear(attempt, {
          kind: 'signedOut',
          error:
            'Signed out on this device. Remote sign-out could not be confirmed.',
        });
      } catch {
        if (attempt === generation)
          set({
            kind: 'unavailable',
            message: 'Could not clear sign-in. Retry signing out.',
          });
      }
    }
  }
  async function expire(token: string) {
    if (state.kind !== 'signedIn' || state.token !== token) return;
    invalidateIdentity();
    const attempt = ++generation;
    set({ kind: 'loading' });
    try {
      await clear(attempt, {
        kind: 'signedOut',
        error: 'Your session expired. Sign in again.',
      });
    } catch {
      if (attempt === generation)
        set({
          kind: 'unavailable',
          message: 'Could not clear expired sign-in. Retry.',
        });
    }
  }
  async function withProviderAccount<T>(
    operation: (
      credentials: ProviderSession,
      account: NonNullable<ProviderLifecycle['account']>,
    ) => Promise<T>,
  ) {
    const current = state;
    const attempt = generation;
    if (current.kind !== 'signedIn' || !provider?.account)
      throw new Error(
        'Account editing is unavailable. Sign in with email and try again.',
      );
    const account = provider.account;
    const lifecycle = provider;
    const token = current.token;
    function assertCurrent() {
      if (
        attempt !== generation ||
        state.kind !== 'signedIn' ||
        state.token !== token
      )
        throw new Error('Account changed. Reopen Account and try again.');
    }
    // Share the credential queue with logout/refresh, so rotated tokens are
    // persisted before a queued revocation reads them. Never retry writes.
    return withStorage(async () => {
      assertCurrent();
      const stored = await storage.read();
      assertCurrent();
      if (
        stored?.kind !== 'active' ||
        stored.token !== current.token ||
        !stored.provider
      )
        throw new Error(
          'Account editing is unavailable. Sign in with email and try again.',
        );
      let credentials = stored.provider;
      if (credentials.expiresAt <= Date.now() + 60000) {
        const next = await lifecycle.refresh(credentials);
        if (next.subject !== credentials.subject)
          throw new Error('Account identity changed. Sign in again.');
        try {
          await storage.write({ ...stored, provider: next });
        } catch (error) {
          await lifecycle.revoke(next);
          throw error;
        }
        credentials = next;
        assertCurrent();
      }
      const result = await operation(credentials, account);
      assertCurrent();
      return result;
    });
  }
  return {
    readAccountDetails: () =>
      withProviderAccount((credentials, account) => account.read(credentials)),
    updateAccount: (change: AccountChange) =>
      withProviderAccount((credentials, account) =>
        account.update(credentials, change),
      ),
    requestAccountCode: () =>
      withProviderAccount((credentials, account) =>
        account.reauthenticate(credentials),
      ),
    getState: () => state,
    // Explicit loss of identity must close private drafts before loading hides its cause.
    subscribeIdentityInvalidation: (listener: () => void) => {
      identityListeners.add(listener);
      return () => {
        identityListeners.delete(listener);
      };
    },
    cancelSignIn: () => {
      if (
        state.kind !== 'signedOut' &&
        !(state.kind === 'loading' && authenticationGeneration === generation)
      )
        return;
      ++generation;
      authenticationGeneration = null;
      set({ kind: 'signedOut', error: null });
    },
    dismissSignInMessage: () => {
      if (state.kind === 'signedOut') set({ kind: 'signedOut', error: null });
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    resume,
    signIn,
    logout,
    expire,
    select: async (selected: 'real' | 'demo') => {
      if (state.kind !== 'signedIn' || state.selected === selected) return;
      invalidateIdentity();
      const current = state;
      const attempt = ++generation;
      set({ kind: 'loading' });
      try {
        await withStorage(async () => {
          if (attempt !== generation) return;
          const stored = await storage.read();
          if (attempt !== generation) return;
          await storage.write({
            kind: 'active',
            token: current.token,
            selected,
            ...(stored?.token === current.token && stored.provider
              ? { provider: stored.provider }
              : {}),
          });
          if (attempt === generation) set({ ...current, selected });
        });
      } catch (error) {
        if (attempt === generation) set(current);
        throw error;
      }
    },
    rename: async (displayName: string, target?: 'real') => {
      if (state.kind !== 'signedIn') return;
      const current = state;
      const profile = current.account.profiles.find(
        (profile) => profile.kind === (target ?? current.selected),
      );
      if (!profile) return;
      let updated;
      try {
        updated = await api.rename(current.token, profile.id, displayName);
      } catch (error) {
        if (error instanceof AccountError && error.status === 401)
          await expire(current.token);
        throw error;
      }
      if (state.kind === 'signedIn' && state.token === current.token)
        set({
          ...state,
          account: {
            ...state.account,
            profiles: state.account.profiles.map((p) =>
              p.id === updated.id ? updated : p,
            ),
          },
        });
    },
  };
}
