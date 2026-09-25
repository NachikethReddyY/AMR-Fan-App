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
  const listeners = new Set<() => void>();
  const set = (next: SessionState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function revoke(token: string) {
    try {
      await api.logout(token);
    } catch (error) {
      if (!(error instanceof AccountError && error.status === 401)) throw error;
    }
    await storage.clear();
    set({ kind: 'signedOut', error: null });
  }
  async function resume() {
    const attempt = ++generation;
    set({ kind: 'loading' });
    try {
      const stored = await storage.read();
      if (attempt !== generation) return;
      if (!stored) return set({ kind: 'signedOut', error: null });
      if (stored.kind === 'revoking') return await revoke(stored.token);
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
        await storage.clear();
        set({ kind: 'signedOut', error: error.message });
      } else
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
        await api.logout(session.token);
        return;
      }
      try {
        await storage.write({
          kind: 'active',
          token: session.token,
          selected: 'real',
        });
      } catch (error) {
        await api.logout(session.token);
        throw error;
      }
      set({
        kind: 'signedIn',
        account: session.account,
        token: session.token,
        selected: 'real',
      });
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
    if (state.kind !== 'signedIn') return;
    const token = state.token;
    ++generation;
    set({ kind: 'loading' });
    try {
      // Persist revocation intent before network I/O so offline restarts cannot resume.
      await storage.write({ kind: 'revoking', token });
      await revoke(token);
    } catch {
      set({
        kind: 'unavailable',
        message:
          'Sign-out is pending. Reconnect and retry to revoke this session.',
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
    expire: async (token: string) => {
      if (state.kind !== 'signedIn' || state.token !== token) return;
      const attempt = ++generation;
      set({ kind: 'loading' });
      try {
        await storage.clear();
        if (attempt === generation)
          set({
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
    },
    select: async (selected: 'real' | 'demo') => {
      if (state.kind !== 'signedIn') return;
      const current = state;
      const attempt = ++generation;
      set({ kind: 'loading' });
      try {
        await storage.write({ kind: 'active', token: current.token, selected });
        if (attempt === generation) set({ ...current, selected });
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
      const updated = await api.rename(current.token, profile.id, displayName);
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
