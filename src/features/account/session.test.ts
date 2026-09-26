import { jest, test, expect } from '@jest/globals';
import {
  AccountError,
  type Account,
  type AccountApi,
  type Session,
} from './api';
import { createSessionController, type StoredSession } from './session';
const account: Account = {
  id: 'a',
  role: 'fan',
  profiles: [
    { id: 'real-a', kind: 'real', displayName: 'Fan', balance: 0 },
    { id: 'demo-a', kind: 'demo', displayName: 'Fan', balance: 0 },
  ],
};
function fixture() {
  let stored: StoredSession | null = null;
  const api: AccountApi = {
    signIn: jest.fn(async () => ({
      token: 'token',
      expiresAt: '2030-01-01',
      account,
    })),
    syntheticSignIn: jest.fn(async () => ({
      token: 'token',
      expiresAt: '2030-01-01',
      account,
    })),
    resume: jest.fn(async () => account),
    logout: jest.fn(async () => {}),
    rename: jest.fn(async () => account.profiles[0]),
    history: jest.fn(async () => ({
      profile: account.profiles[0],
      balance: 0,
      entries: [],
      nextCursor: null,
    })),
  };
  const storage = {
    read: async () => stored,
    write: async (value: StoredSession) => {
      stored = value;
    },
    clear: async () => {
      stored = null;
    },
  };
  return {
    api,
    storage,
    get stored() {
      return stored;
    },
  };
}
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function identity(token: string): Session {
  return {
    token,
    expiresAt: '2030-01-01',
    account: {
      ...account,
      id: token,
      profiles: account.profiles.map((p) => ({
        ...p,
        id: `${token}-${p.kind}`,
      })),
    },
  };
}

test('R28-1: delayed A storage write cannot overwrite replacement B in memory or after restart', async () => {
  const f = fixture();
  const write = f.storage.write;
  const entered = deferred<void>();
  const release = deferred<void>();
  const authenticatedB = deferred<void>();
  f.storage.write = async (value) => {
    if (value.token === 'A') {
      entered.resolve();
      await release.promise;
    }
    await write(value);
  };
  f.api.resume = async (token) => identity(token).account;
  const c = createSessionController(f.api, f.storage);
  const a = c.signIn(async () => identity('A'));
  await entered.promise;
  const b = c.signIn(async () => {
    authenticatedB.resolve();
    return identity('B');
  });
  await authenticatedB.promise;
  release.resolve();
  await Promise.all([a, b]);
  expect({ state: c.getState(), stored: f.stored }).toMatchObject({
    state: { kind: 'signedIn', token: 'B' },
    stored: { kind: 'active', token: 'B' },
  });
  const restarted = createSessionController(f.api, f.storage);
  await restarted.resume();
  expect(restarted.getState()).toMatchObject({
    kind: 'signedIn',
    token: 'B',
    account: { id: 'B' },
  });
  expect(f.api.logout).toHaveBeenCalledWith('A');
  expect(f.api.logout).not.toHaveBeenCalledWith('B');
});

test('R28-2: rename401 expires matching active session and persisted credential', async () => {
  const f = fixture();
  const c = createSessionController(f.api, f.storage);
  await c.signIn(async () => identity('A'));
  f.api.rename = async () => {
    throw new AccountError(401, 'Expired');
  };
  await expect(c.rename('Renamed')).rejects.toMatchObject({ status: 401 });
  expect({ state: c.getState(), stored: f.stored }).toMatchObject({
    state: { kind: 'signedOut' },
    stored: null,
  });
});

test('a newer failed sign-in cannot leave superseded A persisted; restart stays signed out', async () => {
  const f = fixture();
  const entered = deferred<void>();
  const release = deferred<void>();
  const write = f.storage.write;
  f.storage.write = async (value) => {
    entered.resolve();
    await release.promise;
    await write(value);
  };
  const c = createSessionController(f.api, f.storage);
  const a = c.signIn(async () => identity('A'));
  await entered.promise;
  await c.signIn(async () => {
    throw new Error('B authentication failed');
  });
  release.resolve();
  await a;
  expect(c.getState()).toMatchObject({
    kind: 'signedOut',
    error: 'B authentication failed',
  });
  expect(f.stored).toBeNull();
  expect(f.api.logout).toHaveBeenCalledWith('A');
  const restarted = createSessionController(f.api, f.storage);
  await restarted.resume();
  expect(restarted.getState().kind).toBe('signedOut');
});

test.each(['success', 'failure'] as const)(
  'late A logout %s cannot clear or hide replacement B',
  async (result) => {
    const f = fixture();
    const entered = deferred<void>();
    const release = deferred<void>();
    f.api.logout = jest.fn(async () => {
      entered.resolve();
      await release.promise;
    });
    f.api.resume = async (token) => identity(token).account;
    const c = createSessionController(f.api, f.storage);
    await c.signIn(async () => identity('A'));
    const logout = c.logout();
    await entered.promise;
    expect(f.stored).toEqual({ kind: 'revoking', token: 'A' });
    await c.signIn(async () => identity('B'));
    if (result === 'success') release.resolve();
    else release.reject(new Error('Offline'));
    await logout;
    expect(c.getState()).toMatchObject({ kind: 'signedIn', token: 'B' });
    expect(f.stored).toMatchObject({ kind: 'active', token: 'B' });
    const restarted = createSessionController(f.api, f.storage);
    await restarted.resume();
    expect(restarted.getState()).toMatchObject({
      kind: 'signedIn',
      token: 'B',
    });
    expect(f.api.logout).toHaveBeenCalledTimes(1);
    expect(f.api.logout).not.toHaveBeenCalledWith('B');
  },
);

test('logout cancels a pending sign-in write, and a late authentication result cannot reopen it', async () => {
  const f = fixture();
  const entered = deferred<void>();
  const release = deferred<void>();
  const write = f.storage.write;
  f.storage.write = async (value) => {
    entered.resolve();
    await release.promise;
    await write(value);
  };
  const c = createSessionController(f.api, f.storage);
  const a = c.signIn(async () => identity('A'));
  await entered.promise;
  const logout = c.logout();
  release.resolve();
  await Promise.all([a, logout]);
  expect(c.getState().kind).toBe('signedOut');
  expect(f.stored).toBeNull();
  expect(f.api.logout).toHaveBeenCalledWith('A');
  const late = deferred<Session>();
  const b = c.signIn(() => late.promise);
  await c.logout();
  late.resolve(identity('B'));
  await b;
  expect(c.getState().kind).toBe('signedOut');
  expect(f.stored).toBeNull();
  expect(f.api.logout).toHaveBeenCalledWith('B');
});

test('a partially failed A storage write and failed revocation do not poison queued B persistence', async () => {
  const f = fixture();
  const entered = deferred<void>();
  const release = deferred<void>();
  const authenticatedB = deferred<void>();
  const write = f.storage.write;
  f.storage.write = async (value) => {
    if (value.token === 'A') {
      entered.resolve();
      await release.promise;
      await write(value);
      throw new Error('Storage reported failure after writing');
    }
    await write(value);
  };
  f.api.logout = jest.fn(async () => {
    throw new Error('Revocation offline');
  });
  const c = createSessionController(f.api, f.storage);
  const a = c.signIn(async () => identity('A'));
  await entered.promise;
  const b = c.signIn(async () => {
    authenticatedB.resolve();
    return identity('B');
  });
  await authenticatedB.promise;
  release.resolve();
  await Promise.all([a, b]);
  expect(c.getState()).toMatchObject({ kind: 'signedIn', token: 'B' });
  expect(f.stored).toMatchObject({ kind: 'active', token: 'B' });
  expect(f.api.logout).toHaveBeenCalledTimes(1);
  expect(f.api.logout).toHaveBeenCalledWith('A');
});

test('delayed rename401 from A cannot invalidate B, including its restored identity', async () => {
  const f = fixture();
  const response = deferred<Account['profiles'][number]>();
  f.api.rename = () => response.promise;
  f.api.resume = async (token) => identity(token).account;
  const c = createSessionController(f.api, f.storage);
  await c.signIn(async () => identity('A'));
  const renamed = expect(c.rename('Old name')).rejects.toMatchObject({
    status: 401,
  });
  await c.signIn(async () => identity('B'));
  response.reject(new AccountError(401, 'Expired'));
  await renamed;
  expect(c.getState()).toMatchObject({ kind: 'signedIn', token: 'B' });
  expect(f.stored).toMatchObject({ kind: 'active', token: 'B' });
  const restarted = createSessionController(f.api, f.storage);
  await restarted.resume();
  expect(restarted.getState()).toMatchObject({ kind: 'signedIn', token: 'B' });
});

test('expiry clear is serialized before replacement B write and cannot erase B on completion', async () => {
  const f = fixture();
  const entered = deferred<void>();
  const release = deferred<void>();
  const authenticatedB = deferred<void>();
  const clear = f.storage.clear;
  f.storage.clear = async () => {
    entered.resolve();
    await release.promise;
    await clear();
  };
  f.api.rename = async () => {
    throw new AccountError(401, 'Expired');
  };
  const c = createSessionController(f.api, f.storage);
  await c.signIn(async () => identity('A'));
  const renamed = expect(c.rename('Old name')).rejects.toMatchObject({
    status: 401,
  });
  await entered.promise;
  const b = c.signIn(async () => {
    authenticatedB.resolve();
    return identity('B');
  });
  await authenticatedB.promise;
  release.resolve();
  await Promise.all([renamed, b]);
  expect(c.getState()).toMatchObject({ kind: 'signedIn', token: 'B' });
  expect(f.stored).toMatchObject({ kind: 'active', token: 'B' });
});

test.each([400, 503])(
  'rename%s preserves current identity for correction or retry',
  async (status) => {
    const f = fixture();
    f.api.rename = async () => {
      throw new AccountError(status, 'Cannot save');
    };
    const c = createSessionController(f.api, f.storage);
    await c.signIn(async () => identity('A'));
    await expect(c.rename('Name')).rejects.toMatchObject({ status });
    expect(c.getState()).toMatchObject({ kind: 'signedIn', token: 'A' });
    expect(f.stored).toMatchObject({ kind: 'active', token: 'A' });
  },
);

test('failed expired-credential cleanup hides authority and a later resume retries safely', async () => {
  const f = fixture();
  const clear = f.storage.clear;
  f.storage.clear = async () => {
    throw new Error('SecureStore unavailable');
  };
  f.api.rename = async () => {
    throw new AccountError(401, 'Expired');
  };
  f.api.resume = async () => {
    throw new AccountError(401, 'Expired');
  };
  const c = createSessionController(f.api, f.storage);
  await c.signIn(async () => identity('A'));
  await expect(c.rename('Name')).rejects.toMatchObject({ status: 401 });
  expect(c.getState().kind).toBe('unavailable');
  await c.resume();
  expect(c.getState().kind).toBe('unavailable');
  f.storage.clear = clear;
  await c.resume();
  expect(c.getState().kind).toBe('signedOut');
  expect(f.stored).toBeNull();
});

test('an in-flight demo selection cannot overwrite replacement B persistence', async () => {
  const f = fixture();
  const entered = deferred<void>();
  const release = deferred<void>();
  const authenticatedB = deferred<void>();
  const write = f.storage.write;
  const c = createSessionController(f.api, f.storage);
  await c.signIn(async () => identity('A'));
  f.storage.write = async (value) => {
    if (value.kind === 'active' && value.selected === 'demo') {
      entered.resolve();
      await release.promise;
    }
    await write(value);
  };
  const selected = c.select('demo');
  await entered.promise;
  const b = c.signIn(async () => {
    authenticatedB.resolve();
    return identity('B');
  });
  await authenticatedB.promise;
  release.resolve();
  await Promise.all([selected, b]);
  expect(c.getState()).toMatchObject({
    kind: 'signedIn',
    token: 'B',
    selected: 'real',
  });
  expect(f.stored).toEqual({ kind: 'active', token: 'B', selected: 'real' });
});
test('sign-in persists token, app restart resumes account, demo selection preserves identity', async () => {
  const f = fixture();
  const first = createSessionController(f.api, f.storage);
  await first.signIn(() => f.api.signIn('access'));
  const next = createSessionController(f.api, f.storage);
  await next.resume();
  expect(next.getState()).toMatchObject({ kind: 'signedIn', account });
  expect(f.stored).toEqual({
    kind: 'active',
    token: 'token',
    selected: 'real',
  });
  await next.select('demo');
  expect(next.getState()).toMatchObject({ selected: 'demo', account });
  const third = createSessionController(f.api, f.storage);
  await third.resume();
  expect(third.getState()).toMatchObject({ selected: 'demo', account });
});

test('a History401 hides the active account and removes its stored credential; an old token cannot invalidate a new session', async () => {
  const f = fixture();
  const controller = createSessionController(f.api, f.storage);
  await controller.signIn(() => f.api.signIn('access'));
  await controller.expire('old-token');
  expect(controller.getState().kind).toBe('signedIn');
  const expired = controller.expire('token');
  expect(controller.getState().kind).toBe('loading');
  await expired;
  expect(controller.getState().kind).toBe('signedOut');
  expect(f.stored).toBeNull();
});
test('offline resume never displays cached authority and keeps credential for retry', async () => {
  const f = fixture();
  await f.storage.write({ kind: 'active', token: 'token', selected: 'real' });
  f.api.resume = async () => {
    throw new Error('offline');
  };
  const controller = createSessionController(f.api, f.storage);
  await controller.resume();
  expect(controller.getState().kind).toBe('unavailable');
  expect(f.stored?.kind).toBe('active');
});
test('expired sessions clear storage and return to sign-in', async () => {
  const f = fixture();
  await f.storage.write({ kind: 'active', token: 'token', selected: 'real' });
  f.api.resume = async () => {
    throw new AccountError(401, 'Expired');
  };
  const controller = createSessionController(f.api, f.storage);
  await controller.resume();
  expect(controller.getState().kind).toBe('signedOut');
  expect(f.stored).toBeNull();
});
test('offline logout clears local credentials and cannot restore identity after restart', async () => {
  const f = fixture();
  const c = createSessionController(f.api, f.storage);
  await c.signIn(() => f.api.signIn('access'));
  f.api.logout = async () => {
    throw new Error('offline');
  };
  await c.logout();
  expect(c.getState()).toMatchObject({
    kind: 'signedOut',
    error: expect.stringContaining('could not be confirmed'),
  });
  expect(f.stored).toBeNull();
  const restarted = createSessionController(f.api, f.storage);
  await restarted.resume();
  expect(restarted.getState().kind).toBe('signedOut');
  expect(f.api.resume).not.toHaveBeenCalled();
});

test('a session that cannot be stored is revoked and never displayed', async () => {
  const f = fixture();
  f.storage.write = async () => {
    throw new Error('Secure storage unavailable');
  };
  const controller = createSessionController(f.api, f.storage);
  await controller.signIn(() => f.api.signIn('access'));
  expect(controller.getState().kind).toBe('signedOut');
  expect(f.api.logout).toHaveBeenCalledWith('token');
});

const providerIdentity = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: 1,
  subject: '11111111-1111-4111-8111-111111111111',
};
test('provider refresh rotates durable credentials once, preserves demo and restores on restart', async () => {
  const f = fixture();
  await f.storage.write({
    kind: 'active',
    token: 'A',
    selected: 'demo',
    provider: providerIdentity,
  });
  const lifecycle = {
    refresh: jest.fn(async () => ({
      ...providerIdentity,
      refreshToken: 'next',
      expiresAt: Date.now() + 3600000,
    })),
    revoke: jest.fn(async () => {}),
  };
  const c = createSessionController(f.api, f.storage, lifecycle);
  await c.resume();
  expect(c.getState()).toMatchObject({ kind: 'signedIn', selected: 'demo' });
  expect(f.stored).toMatchObject({ provider: { refreshToken: 'next' } });
  await createSessionController(f.api, f.storage, lifecycle).resume();
  expect(lifecycle.refresh).toHaveBeenCalledTimes(1);
});
test('late refresh cannot overwrite replacement identity, and logout revokes rotated provider credentials', async () => {
  const f = fixture();
  const result = deferred<typeof providerIdentity>();
  const entered = deferred<void>();
  await f.storage.write({
    kind: 'active',
    token: 'A',
    selected: 'real',
    provider: providerIdentity,
  });
  const lifecycle = {
    refresh: jest.fn(async () => {
      entered.resolve();
      return result.promise;
    }),
    revoke: jest.fn(async () => {}),
  };
  const c = createSessionController(f.api, f.storage, lifecycle);
  const first = c.resume();
  await entered.promise;
  const logout = c.logout();
  result.resolve({ ...providerIdentity, refreshToken: 'rotated' });
  await Promise.all([first, logout]);
  expect(lifecycle.revoke).toHaveBeenCalledWith(
    expect.objectContaining({ refreshToken: 'rotated' }),
  );
  expect(f.stored).toBeNull();
  expect(c.getState().kind).toBe('signedOut');
});
test('API401 never refreshes or exchanges a revoked app session', async () => {
  const f = fixture();
  await f.storage.write({
    kind: 'active',
    token: 'A',
    selected: 'real',
    provider: providerIdentity,
  });
  f.api.resume = async () => {
    throw new AccountError(401, 'expired');
  };
  const lifecycle = {
    refresh: jest.fn(async () => providerIdentity),
    revoke: jest.fn(async () => {}),
  };
  await createSessionController(f.api, f.storage, lifecycle).resume();
  expect(lifecycle.refresh).not.toHaveBeenCalled();
  expect(f.stored).toBeNull();
});
test('provider logout failure still clears credentials after app-session revocation', async () => {
  const f = fixture();
  const lifecycle = {
    refresh: async () => providerIdentity,
    revoke: jest.fn(async (): Promise<void> => {
      throw new Error('offline');
    }),
  };
  const c = createSessionController(f.api, f.storage, lifecycle);
  await c.signIn(async () => ({
    ...identity('A'),
    provider: providerIdentity,
  }));
  await c.logout();
  expect(f.api.logout).toHaveBeenCalledWith('A');
  expect(lifecycle.revoke).toHaveBeenCalledWith(providerIdentity);
  expect(f.stored).toBeNull();
  expect(c.getState().kind).toBe('signedOut');
});
test('failed app revocation still attempts provider logout and clears only its own generation', async () => {
  const f = fixture();
  const release = deferred<void>();
  const entered = deferred<void>();
  const lifecycle = {
    refresh: async () => providerIdentity,
    revoke: jest.fn(async () => {}),
  };
  f.api.logout = async () => {
    entered.resolve();
    await release.promise;
    throw new Error('offline');
  };
  const c = createSessionController(f.api, f.storage, lifecycle);
  await c.signIn(async () => ({
    ...identity('A'),
    provider: providerIdentity,
  }));
  const logout = c.logout();
  await entered.promise;
  await c.signIn(async () => identity('B'));
  release.resolve();
  await logout;
  expect(lifecycle.revoke).toHaveBeenCalledWith(providerIdentity);
  expect(f.stored).toMatchObject({ kind: 'active', token: 'B' });
  expect(c.getState()).toMatchObject({ kind: 'signedIn', token: 'B' });
});

test('delayed provider refresh and replacement sign-in persist only the replacement after restart', async () => {
  const f = fixture();
  const release = deferred<typeof providerIdentity>();
  const entered = deferred<void>();
  await f.storage.write({
    kind: 'active',
    token: 'A',
    selected: 'demo',
    provider: providerIdentity,
  });
  const lifecycle = {
    refresh: async () => {
      entered.resolve();
      return release.promise;
    },
    revoke: async () => {},
  };
  const c = createSessionController(f.api, f.storage, lifecycle);
  const first = c.resume();
  await entered.promise;
  const replacement = c.signIn(async () => ({
    ...identity('B'),
    provider: {
      ...providerIdentity,
      refreshToken: 'B',
      expiresAt: Date.now() + 3600000,
    },
  }));
  release.resolve({ ...providerIdentity, refreshToken: 'A-next' });
  await Promise.all([first, replacement]);
  expect(f.stored).toMatchObject({
    token: 'B',
    provider: { refreshToken: 'B' },
  });
  const restarted = createSessionController(f.api, f.storage, lifecycle);
  await restarted.resume();
  expect(restarted.getState()).toMatchObject({ token: 'B', kind: 'signedIn' });
});
test('late created provider session after logout is revoked and never published', async () => {
  const f = fixture();
  const release = deferred<Session & { provider: typeof providerIdentity }>();
  const lifecycle = {
    refresh: async () => providerIdentity,
    revoke: jest.fn(async () => {}),
  };
  const c = createSessionController(f.api, f.storage, lifecycle);
  const first = c.signIn(() => release.promise);
  await c.logout();
  release.resolve({ ...identity('A'), provider: providerIdentity });
  await first;
  expect(f.stored).toBeNull();
  expect(lifecycle.revoke).toHaveBeenCalledWith(providerIdentity);
});
test('profile selection retains provider credentials and confirmation creates no app session', async () => {
  const f = fixture();
  const c = createSessionController(f.api, f.storage);
  await c.signIn(async () => ({
    ...identity('A'),
    provider: providerIdentity,
  }));
  await c.select('demo');
  expect(f.stored).toMatchObject({
    selected: 'demo',
    provider: providerIdentity,
  });
  const fresh = fixture();
  const other = createSessionController(fresh.api, fresh.storage);
  await other.signIn(async () => ({ kind: 'confirmation' }));
  expect(fresh.stored).toBeNull();
  expect(other.getState()).toMatchObject({
    kind: 'signedOut',
    error: expect.stringContaining('confirmation'),
  });
});
test('logout still revokes both sessions when persisting revocation intent fails', async () => {
  const f = fixture();
  const lifecycle = {
    refresh: async () => providerIdentity,
    revoke: jest.fn(async () => {}),
  };
  const c = createSessionController(f.api, f.storage, lifecycle);
  await c.signIn(async () => ({
    ...identity('A'),
    provider: providerIdentity,
  }));
  f.storage.write = async () => {
    throw new Error('write unavailable');
  };
  await c.logout();
  expect(f.api.logout).toHaveBeenCalledWith('A');
  expect(lifecycle.revoke).toHaveBeenCalledWith(providerIdentity);
  expect(f.stored).toBeNull();
});
test('changing authentication intent clears stale confirmation copy without touching a session', async () => {
  const f = fixture();
  const c = createSessionController(f.api, f.storage);
  await c.signIn(async () => ({ kind: 'confirmation' }));
  c.dismissSignInMessage();
  expect(c.getState()).toEqual({ kind: 'signedOut', error: null });
  await c.signIn(async () => identity('A'));
  c.dismissSignInMessage();
  expect(c.getState()).toMatchObject({ kind: 'signedIn', token: 'A' });
  expect(f.stored?.token).toBe('A');
});
