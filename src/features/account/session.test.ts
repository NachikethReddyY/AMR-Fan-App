import { jest, test, expect } from '@jest/globals';
import { AccountError, type Account, type AccountApi } from './api';
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
test('logout hides data immediately; offline revocation survives restart and cannot resume identity', async () => {
  const f = fixture();
  const controller = createSessionController(f.api, f.storage);
  await controller.signIn(() => f.api.signIn('access'));
  f.api.logout = async () => {
    throw new Error('offline');
  };
  await controller.logout();
  expect(controller.getState().kind).toBe('unavailable');
  expect(f.stored?.kind).toBe('revoking');
  const next = createSessionController(f.api, f.storage);
  await next.resume();
  expect(next.getState().kind).toBe('unavailable');
  expect(f.api.resume).not.toHaveBeenCalled();
  f.api.logout = async () => {};
  await next.resume();
  expect(next.getState().kind).toBe('signedOut');
  expect(f.stored).toBeNull();
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
