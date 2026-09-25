import {
  AccountError,
  type Account,
  type AccountApi,
  type Session,
} from './api.ts';
export type StoredSession =
  | { kind: 'active'; token: string; selected: 'real' | 'demo' }
  | { kind: 'revoking'; token: string };
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

export function createSessionController(api: AccountApi, storage: Storage) {
  let state: SessionState = { kind: 'loading' };
  let generation = 0;
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
  async function revoke(token: string, attempt: number) {
    await revokeToken(token);
    await clear(attempt, { kind: 'signedOut', error: null });
  }
  async function resume() {
    const attempt = ++generation;
    set({ kind: 'loading' });
    try {
      const stored = await withStorage(() => storage.read());
      if (attempt !== generation) return;
      if (!stored) return set({ kind: 'signedOut', error: null });
      if (stored.kind === 'revoking')
        return await revoke(stored.token, attempt);
      const account = await api.resume(stored.token);
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
  async function signIn(authenticate: () => Promise<Session>) {
    const attempt = ++generation;
    set({ kind: 'loading' });
    try {
      const session = await authenticate();
      if (attempt !== generation) {
        await revokeToken(session.token);
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
        await revokeToken(session.token);
        throw error;
      }
      if (!published) await revokeToken(session.token);
    } catch (error) {
      if (attempt === generation)
        set({
          kind: 'signedOut',
          error:
            error instanceof Error
              ? error.message
              : 'Sign-in failed. Try again.',
        });
    }
  }
  async function logout() {
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
        await storage.write({ kind: 'revoking', token: stored.token });
        return stored.token;
      });
      if (token) await revoke(token, attempt);
    } catch {
      if (attempt === generation)
        set({
          kind: 'unavailable',
          message:
            'Sign-out is pending. Reconnect and retry to revoke this session.',
        });
    }
  }
  async function expire(token: string) {
    if (state.kind !== 'signedIn' || state.token !== token) return;
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
  return {
    getState: () => state,
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
      if (state.kind !== 'signedIn') return;
      const current = state;
      const attempt = ++generation;
      set({ kind: 'loading' });
      try {
        await withStorage(async () => {
          if (attempt !== generation) return;
          await storage.write({
            kind: 'active',
            token: current.token,
            selected,
          });
          if (attempt === generation) set({ ...current, selected });
        });
      } catch (error) {
        if (attempt === generation) set(current);
        throw error;
      }
    },
    rename: async (displayName: string) => {
      if (state.kind !== 'signedIn') return;
      const current = state;
      const profile = current.account.profiles.find(
        (profile) => profile.kind === current.selected,
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
