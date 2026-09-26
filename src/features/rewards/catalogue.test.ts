import { createCatalogue } from './catalogue';
import { createRewardsApi } from './api';
import type { Offer } from './contracts';
const id = '10000000-0000-4000-8000-000000000001';
const otherId = '10000000-0000-4000-8000-000000000002';
const offer = {
  id,
  version: 1,
  enabled: true,
  product: {
    kind: 'content',
    title: 'Fan story',
    description: 'A catalogue description',
    pointsPrice: 75,
  },
} satisfies Offer;
test('guest catalogue sends no token/profile, validates prices and strips private fields', async () => {
  const request = jest.fn(async () => ({
    offers: [{ ...offer, product: { ...offer.product, text: 'private' } }],
    nextCursor: null,
  }));
  const api = createRewardsApi(request);
  const page = await api.catalogue(id);
  expect(request).toHaveBeenCalledWith(
    `/v1/rewards/offers?limit=25&after=${id}`,
  );
  expect(page.items[0]).toEqual(offer);
  request.mockResolvedValue({
    offers: [
      {
        ...offer,
        product: { ...offer.product, pointsPrice: -1, text: 'private' },
      },
    ],
    nextCursor: null,
  });
  await expect(api.catalogue()).rejects.toThrow();
});
test('guest pagination, empty/error/retry and invalid repeated cursor retain safe state', async () => {
  const read = jest.fn(async (_cursor?: string) => ({
    items: [offer],
    nextCursor: id as string | null,
  }));
  const c = createCatalogue(read);
  await c.start();
  expect(c.getState()).toMatchObject({ kind: 'ready', items: [offer] });
  read.mockResolvedValue({
    items: [{ ...offer, id: otherId }],
    nextCursor: null,
  });
  await c.more();
  expect(read).toHaveBeenLastCalledWith(id);
  expect(c.getState()).toMatchObject({
    kind: 'ready',
    items: [offer, { ...offer, id: otherId }],
  });
  read.mockRejectedValue(new Error('offline'));
  await c.refresh();
  expect(c.getState().kind).toBe('error');
  read.mockResolvedValue({ items: [], nextCursor: null });
  await c.refresh();
  expect(c.getState()).toMatchObject({ kind: 'ready', items: [] });
  read.mockResolvedValue({ items: [offer], nextCursor: id });
  await c.refresh();
  await c.more();
  expect(c.getState()).toMatchObject({
    kind: 'ready',
    items: [offer],
    error: 'Could not load more offers. Retry.',
  });
});
test('sign-in unmount rejects late guest response; logout remount starts a fresh catalogue', async () => {
  let resolve!: (page: { items: (typeof offer)[]; nextCursor: null }) => void;
  const old = new Promise<{ items: (typeof offer)[]; nextCursor: null }>(
    (done) => {
      resolve = done;
    },
  );
  const read = jest.fn(() => old);
  const c = createCatalogue(read);
  const loading = c.start();
  c.stop();
  read.mockResolvedValue({
    items: [{ ...offer, id: otherId }],
    nextCursor: null,
  });
  await c.start();
  resolve({ items: [offer], nextCursor: null });
  await loading;
  expect(c.getState()).toMatchObject({
    kind: 'ready',
    items: [{ ...offer, id: otherId }],
  });
  c.stop();
  expect(c.getState()).toEqual({ kind: 'idle' });
});

test('guest, authenticated and logout transitions select public versus protected readers without fake context', async () => {
  const request = jest.fn(async () => ({ offers: [offer], nextCursor: null }));
  const api = createRewardsApi(request);
  const guest = createCatalogue(api.catalogue);
  await guest.start();
  expect(request.mock.calls).toEqual([['/v1/rewards/offers?limit=25']]);
  guest.stop();
  await api.offers({ token: 'signed-in-token', profileId: id });
  expect(request).toHaveBeenLastCalledWith(
    `/v1/profiles/${id}/rewards/offers?limit=25`,
    'signed-in-token',
  );
  request.mockClear();
  await guest.start();
  expect(request.mock.calls).toEqual([['/v1/rewards/offers?limit=25']]);
  guest.stop();
});
