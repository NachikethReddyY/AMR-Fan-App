import { afterEach, expect, jest, test } from '@jest/globals';
import { AccountError } from '../src/features/account/api';
import { createMissionsApi } from '../src/features/missions/api';

const profileId = '00000000-0000-4000-8000-000000000001';
const missionId = '00000000-0000-4000-8000-000000000002';
const mission = {
  id: missionId,
  slug: 'cleanup',
  title: 'Clean up',
  category: 'cleanup',
  kind: 'personal',
  target: 3,
  communityTarget: null,
  policyVersion: 'activity-reward-v1',
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2027-01-01T00:00:00.000Z',
  timezone: 'UTC',
  status: 'active',
  version: 1,
  availability: 'active',
  progress: { kind: 'enrolled', count: 1 },
  communityProgress: 2,
  attribution: { sourceLabel: 'AMR sustainability team' },
};
const fetchMock = jest.fn<typeof fetch>();
function response(value: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  } as Response;
}
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: fetchMock,
});
afterEach(() => {
  fetchMock.mockReset();
  jest.restoreAllMocks();
});

test('missions list sends the authenticated profile query and parses the response', async () => {
  fetchMock.mockResolvedValue(
    response({
      kind: 'available',
      missions: [mission],
      recommendedMissionId: missionId,
    }),
  );
  const result = await createMissionsApi(
    'https://api.example.invalid',
    false,
  ).list('token', profileId, new AbortController().signal);
  expect(result).toMatchObject({
    kind: 'available',
    recommendedMissionId: missionId,
  });
  expect(fetchMock).toHaveBeenCalledWith(
    `https://api.example.invalid/v1/missions?profileId=${profileId}`,
    expect.objectContaining({
      method: 'GET',
      headers: { Authorization: 'Bearer token' },
    }),
  );
});

test('enroll posts the profile owner and parses idempotent enrollment results', async () => {
  fetchMock.mockResolvedValue(
    response({ kind: 'already_enrolled', missionId, version: 1 }),
  );
  const result = await createMissionsApi(
    'https://api.example.invalid',
    false,
  ).enroll('token', missionId, profileId, new AbortController().signal);
  expect(result).toEqual({ kind: 'already_enrolled', missionId, version: 1 });
  expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
    method: 'POST',
    headers: {
      Authorization: 'Bearer token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ profileId }),
  });
});

test('demo/unavailable mission responses are preserved and HTTP failures retain auth status', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      kind: 'unavailable',
      reason: 'demo_profile',
      missions: [],
      recommendedMissionId: null,
    }),
  );
  await expect(
    createMissionsApi('https://api.example.invalid', false).list(
      'token',
      profileId,
      new AbortController().signal,
    ),
  ).resolves.toMatchObject({ kind: 'unavailable', reason: 'demo_profile' });
  fetchMock.mockResolvedValueOnce(response(null, 401));
  await expect(
    createMissionsApi('https://api.example.invalid', false).list(
      'token',
      profileId,
      new AbortController().signal,
    ),
  ).rejects.toEqual(
    expect.objectContaining({ status: 401 } satisfies Partial<AccountError>),
  );
});

test('production mission URLs must be HTTPS and an empty base performs no network', async () => {
  expect(() => createMissionsApi('http://api.example.invalid', false)).toThrow(
    'Use a secure API URL.',
  );
  await expect(
    createMissionsApi('', true).list(
      'token',
      profileId,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ status: 503 });
  expect(fetchMock).not.toHaveBeenCalled();
});
