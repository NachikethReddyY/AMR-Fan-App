import { expect, jest, test } from '@jest/globals';
import { AccountError } from '../account/api';
import { createHistoryController } from './history';
import { parseHistoryPage, type HistoryPage } from './contracts';

const real = '00000000-0000-4000-8000-000000000001';
const demo = '00000000-0000-4000-8000-000000000002';
const actor = '00000000-0000-4000-8000-000000000003';
function page(
  id = real,
  sequences = ['10', '9'],
  nextCursor: string | null = null,
): HistoryPage {
  return {
    profile: {
      id,
      kind: id === real ? 'real' : 'demo',
      displayName: 'Fan',
      balance: 60,
    },
    balance: 60,
    entries: sequences.map((sequence, index) => ({
      id: `00000000-0000-4000-8000-${sequence.padStart(12, '0')}`,
      sequence,
      profileId: id,
      actorId: actor,
      kind: 'admin_adjustment',
      delta: index ? 100 : -40,
      balanceAfter: index ? 100 : 60,
      reason: 'Synthetic adjustment',
      recordedAt: '2026-09-26T00:00:00.000Z',
    })),
    nextCursor,
  };
}
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
test('response validates owner, bounds, cursor and large values without sorting numeric strings', () => {
  expect(parseHistoryPage(page(), real).entries.map((e) => e.sequence)).toEqual(
    ['10', '9'],
  );
  const value = {
    ...page(),
    balance: 2147483647,
    profile: { ...page().profile, balance: 2147483647 },
    entries: [
      {
        ...page().entries[0],
        sequence: '9007199254740993',
        balanceAfter: 2147483647,
      },
    ],
    nextCursor: '9007199254740993',
  };
  expect(parseHistoryPage(value, real).nextCursor).toBe('9007199254740993');
  for (const invalid of [
    { ...page(), profile: page(demo).profile },
    { ...page(), entries: page(demo).entries },
    { ...page(), balance: -1 },
    { ...page(), nextCursor: 9 },
    { ...page(), balance: 1.5 },
  ])
    expect(() => parseHistoryPage(invalid, real)).toThrow();
});
test('pages preserve server order, coalesce load-more and never sum the current balance', async () => {
  const second = deferred<HistoryPage>();
  const read = jest.fn(async (_token: string, _id: string, before?: string) =>
    before ? second.promise : page(real, ['10', '9'], '9'),
  );
  const c = createHistoryController(
    read,
    jest.fn(() => {}),
  );
  await c.setContext({ token: 'A', profileId: real });
  const one = c.loadMore();
  const two = c.loadMore();
  expect(read).toHaveBeenCalledTimes(2);
  second.resolve(page(real, ['8', '7']));
  await Promise.all([one, two]);
  expect(c.getState()).toMatchObject({
    kind: 'ready',
    page: { balance: 60, nextCursor: null },
  });
  const s = c.getState();
  if (s.kind !== 'ready') throw new Error('Not ready');
  expect(s.page.entries.map((e) => e.sequence)).toEqual(['10', '9', '8', '7']);
  await c.loadMore();
  expect(read).toHaveBeenCalledTimes(2);
});
test('profile/account change and logout clear immediately; late pages cannot affect the new account', async () => {
  const old = deferred<HistoryPage>();
  const expired: string[] = [];
  const read = jest.fn(async (token: string, id: string) =>
    token === 'A' ? old.promise : page(id),
  );
  const c = createHistoryController(read, (token) => {
    expired.push(token);
  });
  const loadingA = c.setContext({ token: 'A', profileId: real });
  await c.setContext({ token: 'B', profileId: demo });
  old.resolve(page(real));
  await loadingA;
  expect(c.getState()).toMatchObject({ kind: 'ready', profileId: demo });
  await c.setContext(null);
  expect(c.getState().kind).toBe('idle');
  expect(expired).toEqual([]);
});
test('refresh hides old balance; outage retry and page failure remain scoped;401 invalidates only current session', async () => {
  let failure = false;
  const expire = jest.fn(() => {});
  const read = jest.fn(async () => {
    if (failure) throw new Error('offline');
    return page(real, ['10'], '10');
  });
  const c = createHistoryController(read, expire);
  await c.setContext({ token: 'A', profileId: real });
  failure = true;
  await c.loadMore();
  expect(c.getState()).toMatchObject({
    kind: 'ready',
    error: expect.any(String),
    page: { balance: 60 },
  });
  const refreshing = c.refresh();
  expect(c.getState().kind).toBe('loading');
  await refreshing;
  expect(c.getState().kind).toBe('unavailable');
  failure = false;
  await c.refresh();
  expect(c.getState().kind).toBe('ready');
  read.mockImplementation(async () => {
    throw new AccountError(401, 'Expired');
  });
  await c.refresh();
  expect(expire).toHaveBeenCalledWith('A');
  expect(c.getState().kind).not.toBe('ready');
});
test('a late successful page after logout stays hidden', async () => {
  const waiting = deferred<HistoryPage>();
  const read = jest.fn(async (_t: string, id: string, before?: string) =>
    before ? waiting.promise : page(id, ['10'], '10'),
  );
  const c = createHistoryController(
    read,
    jest.fn(() => {}),
  );
  await c.setContext({ token: 'A', profileId: real });
  const pending = c.loadMore();
  await c.setContext(null);
  waiting.resolve(page(real, ['9']));
  await pending;
  expect(c.getState().kind).toBe('idle');
});

test('a delayed unauthorized response cannot expire a replacement session', async () => {
  const old = deferred<HistoryPage>();
  const expire = jest.fn(() => {});
  const c = createHistoryController(
    async (token, id) => (token === 'old' ? old.promise : page(id)),
    expire,
  );
  const previous = c.setContext({ token: 'old', profileId: real });
  await c.setContext({ token: 'new', profileId: demo });
  old.reject(new AccountError(401, 'Expired'));
  await previous;
  expect(c.getState()).toMatchObject({ kind: 'ready', profileId: demo });
  expect(expire).not.toHaveBeenCalled();
});

test('refresh supersedes an in-flight page; duplicate pages and foreign-profile denial fail closed', async () => {
  const delayed = deferred<HistoryPage>();
  const read = jest.fn(async (_token: string, _id: string, before?: string) =>
    before ? delayed.promise : page(real, ['10'], '10'),
  );
  const c = createHistoryController(read, () => {});
  await c.setContext({ token: 'A', profileId: real });
  const pending = c.loadMore();
  await c.refresh();
  delayed.resolve(page(real, ['9']));
  await pending;
  expect(c.getState()).toMatchObject({
    kind: 'ready',
    page: { entries: [{ sequence: '10' }] },
  });
  read.mockImplementation(async () => page(real, ['10']));
  await c.loadMore();
  expect(c.getState()).toMatchObject({
    kind: 'ready',
    error: expect.any(String),
    page: { entries: [{ sequence: '10' }] },
  });
  read.mockImplementation(async () => {
    throw new AccountError(404, 'Not found');
  });
  await c.loadMore();
  expect(c.getState().kind).toBe('unavailable');
});
