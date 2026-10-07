import { createActivityApi } from './api';
afterEach(() => jest.restoreAllMocks());
const id = '00000000-0000-4000-8000-000000000001';
const input = {
  requestId: id,
  description: 'cleanup',
  missionId: null,
  photos: [{ mime: 'image/jpeg' as const, base64: 'YWJjZA==' }],
};
test('disabled capability performs no network', async () => {
  const f = jest.spyOn(global, 'fetch');
  await expect(
    createActivityApi('', true).capability(
      't',
      id,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ status: 503 });
  expect(f).not.toHaveBeenCalled();
});
test('capability uses availability endpoint without media', async () => {
  const f = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      kind: 'available',
      mode: 'synthetic_test',
      limits: { photos: 5, description: 1600 },
    }),
  } as Response);
  await createActivityApi('https://api.example.invalid', false).capability(
    't',
    id,
    new AbortController().signal,
  );
  expect(f.mock.calls[0][0]).toBe(
    `https://api.example.invalid/v1/profiles/${id}/activity-submissions/availability`,
  );
  expect(f.mock.calls[0][1]?.body).toBeUndefined();
});
test('submit recover parse and surface conflict', async () => {
  const f = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ kind: 'unavailable', reason: 'disabled' }),
  } as Response);
  const a = createActivityApi('https://api.example.invalid', false);
  await expect(
    a.submit('t', id, input, new AbortController().signal),
  ).resolves.toEqual({ kind: 'unavailable', reason: 'disabled' });
  f.mockResolvedValue({
    ok: true,
    json: async () => ({
      kind: 'replay',
      result: { kind: 'unavailable', reason: 'timeout' },
    }),
  } as Response);
  await expect(
    a.recover('t', id, id, new AbortController().signal),
  ).resolves.toMatchObject({ kind: 'replay' });
  f.mockResolvedValue(new Response(null, { status: 409 }));
  await expect(
    a.submit('t', id, input, new AbortController().signal),
  ).rejects.toMatchObject({ status: 409 });
});
