import { AccountError } from './api';
import { createResource, createIntent } from './resource';

const a = { token: 'A', profileId: 'profile-a' };
const b = { token: 'B', profileId: 'profile-b' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function store() {
  const data = new Map<string, string>();
  return {
    read: async (key: string) => data.get(key) ?? null,
    write: async (key: string, value: string) => {
      data.set(key, value);
    },
    clear: async (key: string) => {
      data.delete(key);
    },
  };
}
test('a delayed page or 401 cannot replace a different profile', async () => {
  const old = deferred<{ items: { id: string }[]; nextCursor: null }>();
  const expired = jest.fn();
  const c = createResource(
    async (ctx) =>
      ctx.token === 'A'
        ? old.promise
        : { items: [{ id: 'B' }], nextCursor: null },
    expired,
  );
  const first = c.setContext(a);
  await c.setContext(b);
  old.reject(new AccountError(401, 'expired'));
  await first;
  expect(c.getState()).toMatchObject({ kind: 'ready', items: [{ id: 'B' }] });
  expect(expired).not.toHaveBeenCalled();
});
test('pages retain opaque cursor, reject duplicate continuation, matching 401 clears', async () => {
  let fail = false;
  const expired = jest.fn();
  const read = jest.fn(async (_ctx, cursor?: string) => {
    if (fail) throw new AccountError(401, 'expired');
    return {
      items: [{ id: 'one' }],
      nextCursor: cursor ? null : '9007199254740993',
    };
  });
  const c = createResource(read, expired);
  await c.setContext(a);
  await c.more();
  expect(read.mock.calls[1][1]).toBe('9007199254740993');
  expect(c.getState()).toMatchObject({
    kind: 'ready',
    items: [{ id: 'one' }],
    error: expect.any(String),
  });
  fail = true;
  await c.refresh();
  expect(c.getState().kind).toBe('idle');
  expect(expired).toHaveBeenCalledWith('A');
});
test('lost purchase response survives restart and retries the identical intent', async () => {
  const storage = store();
  const inputs: unknown[] = [];
  const execute = jest.fn(
    async (_ctx, input: { requestId: string; offerId: string }) => {
      inputs.push(input);
      if (inputs.length === 1) throw new Error('offline after commit');
      return 'receipt';
    },
  );
  const parse = (value: unknown) => {
    if (
      !value ||
      typeof value !== 'object' ||
      !('requestId' in value) ||
      !('offerId' in value) ||
      typeof value.requestId !== 'string' ||
      typeof value.offerId !== 'string'
    )
      throw new Error();
    return { requestId: value.requestId, offerId: value.offerId };
  };
  const create = () =>
    createIntent({
      name: 'reward',
      storage,
      parse,
      execute,
      expired: jest.fn(),
    });
  const first = create();
  await first.setContext(a);
  await first.submit({ requestId: 'same', offerId: 'offer' });
  expect(first.getState().kind).toBe('retry');
  const restarted = create();
  await restarted.setContext(a);
  await restarted.retry();
  expect(inputs).toEqual([
    { requestId: 'same', offerId: 'offer' },
    { requestId: 'same', offerId: 'offer' },
  ]);
  expect(restarted.getState()).toMatchObject({
    kind: 'success',
    result: 'receipt',
  });
});
test('stale price is definitive, and delayed mutation cannot publish or expire newer context', async () => {
  const late = deferred<string>();
  const entered = deferred<void>();
  const expired = jest.fn();
  const c = createIntent({
    name: 'purchase',
    storage: store(),
    parse: (v: unknown) => String(v),
    expired,
    execute: async (ctx) => {
      entered.resolve();
      return ctx.token === 'A' ? late.promise : 'B';
    },
  });
  await c.setContext(a);
  const first = c.submit('purchase-A');
  await entered.promise;
  const switched = c.setContext(b);
  late.reject(new AccountError(401, 'expired'));
  await first;
  await switched;
  expect(c.getState().kind).toBe('idle');
  expect(expired).not.toHaveBeenCalled();
  const stale = createIntent({
    name: 'stale',
    storage: store(),
    parse: (v: unknown) => String(v),
    expired,
    execute: async () => {
      throw new AccountError(409, 'changed');
    },
  });
  await stale.setContext(a);
  await stale.submit('old');
  expect(stale.getState().kind).toBe('rejected');
  await stale.setContext(null);
  await stale.setContext(a);
  expect(stale.getState().kind).toBe('idle');
});
test('an old remounted confirmation cannot clear a newer durable request', async () => {
  const storage = store();
  const old = deferred<string>();
  const started = deferred<void>();
  const newer = deferred<string>();
  const newStarted = deferred<void>();
  const first = createIntent({
    name: 'shared',
    storage,
    parse: (v: unknown) => String(v),
    expired: jest.fn(),
    execute: async () => {
      started.resolve();
      return old.promise;
    },
  });
  await first.setContext(a);
  const oldRun = first.submit('old');
  await started.promise;
  const second = createIntent({
    name: 'shared',
    storage,
    parse: (v: unknown) => String(v),
    expired: jest.fn(),
    execute: async (_ctx, input) => {
      if (input === 'old') return 'old receipt';
      newStarted.resolve();
      return newer.promise;
    },
  });
  await second.setContext(a);
  await second.retry();
  const newRun = second.submit('new');
  await newStarted.promise;
  old.resolve('old receipt');
  await oldRun;
  expect(await storage.read('amr.intent.shared.profile-a')).toBe(
    JSON.stringify('new'),
  );
  newer.resolve('new receipt');
  await newRun;
});
test('an unreadable pending confirmation fails closed instead of allowing a new spend', async () => {
  const execute = jest.fn(async () => true);
  const storage = {
    ...store(),
    read: async () => {
      throw new Error('locked');
    },
  };
  const c = createIntent({
    name: 'locked',
    storage,
    parse: (v: unknown) => v,
    execute,
    expired: jest.fn(),
  });
  await c.setContext(a);
  await c.submit('new');
  expect(execute).not.toHaveBeenCalled();
});

test('failure to clear a definitive rejection preserves retry rather than losing the saved confirmation', async () => {
  const storage = {
    ...store(),
    clear: async () => {
      throw new Error('locked');
    },
  };
  const c = createIntent({
    name: 'cleanup',
    storage,
    parse: (v: unknown) => String(v),
    expired: jest.fn(),
    execute: async () => {
      throw new AccountError(409, 'changed');
    },
  });
  await c.setContext(a);
  await expect(c.submit('request')).resolves.toBeUndefined();
  expect(c.getState().kind).toBe('retry');
});
