import { createActivityApi } from './api';

afterEach(() => jest.restoreAllMocks());
test('disabled build performs no network request and cannot claim credit', async () => {
  const request = jest.spyOn(global, 'fetch');
  expect(
    await createActivityApi('', true)(
      'token',
      'profile',
      new AbortController().signal,
    ),
  ).toEqual({ kind: 'unavailable', creditedPoints: 0 });
  expect(request).not.toHaveBeenCalled();
});
test('availability request carries identity but no media and rejects fabricated credit', async () => {
  const request = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ kind: 'unavailable', creditedPoints: 0 }),
  } as Response);
  const check = createActivityApi('https://api.example.invalid', false);
  await check('token', 'profile', new AbortController().signal);
  expect(request.mock.calls[0][0]).toBe(
    'https://api.example.invalid/v1/profiles/profile/activity/availability',
  );
  expect(request.mock.calls[0][1]?.body).toBeUndefined();
  request.mockResolvedValue({
    ok: true,
    json: async () => ({ kind: 'candidate', creditedPoints: 50 }),
  } as Response);
  await expect(
    check('token', 'profile', new AbortController().signal),
  ).rejects.toThrow();
});

test('authorization failure identifies known expiry without reading or uploading media', async () => {
  const request = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response(null, { status: 401 }));
  await expect(
    createActivityApi('https://api.example.invalid', false)(
      'expired',
      'profile',
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ status: 401 });
  expect(request.mock.calls[0][1]?.body).toBeUndefined();
});
