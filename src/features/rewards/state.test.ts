import { createRewardsApi } from './api';
import { ownedReceipt } from './contracts';
const profileId = '10000000-0000-4000-8000-000000000001';
const offerId = '20000000-0000-4000-8000-000000000001';
const receipt = {
  id: offerId,
  profileId,
  offerId,
  offerVersion: 1,
  title: 'Tree',
  paidPoints: 400,
  purchasedAt: '2026-09-26T00:00:00Z',
  kind: 'tree',
  accountName: 'Original name',
  fulfilment: 'demonstration',
};
test('purchase sends version and request ID without client price/name/balance authority', async () => {
  const request = jest.fn(async () => ({ outcome: receipt }));
  const api = createRewardsApi(request);
  await api.purchase(
    { token: 'A', profileId },
    { requestId: offerId, offerId, offerVersion: 1 },
  );
  expect(request).toHaveBeenCalledWith('/v1/rewards/purchases', 'A', 'POST', {
    requestId: offerId,
    offerId,
    offerVersion: 1,
    profileId,
  });
});
test('retained receipt rejects cross-profile ownership and unknown fulfilment', () => {
  expect(() => ownedReceipt(receipt, 'other')).toThrow();
  expect(() =>
    ownedReceipt({ ...receipt, fulfilment: 'planted' }, profileId),
  ).toThrow();
  expect(ownedReceipt(receipt, profileId)).toMatchObject({
    accountName: 'Original name',
    paidPoints: 400,
  });
});
test('content uses read endpoint, keeps retained version, rejects foreign receipt', async () => {
  const request = jest.fn(async () => ({
    receipt: { ...receipt, kind: 'content', fulfilment: 'unlocked' },
    text: '<script>literal content</script>',
  }));
  const api = createRewardsApi(request);
  const value = await api.content({ token: 'A', profileId }, offerId);
  expect(value.text).toContain('<script>');
  expect(request).toHaveBeenCalledWith(
    `/v1/profiles/${profileId}/rewards/content/${offerId}`,
    'A',
  );
  await expect(
    api.content({ token: 'B', profileId: offerId }, offerId),
  ).rejects.toThrow();
});
