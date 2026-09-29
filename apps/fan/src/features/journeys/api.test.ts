import { createJourneyApi } from './api';
import { journeySchema } from './contracts';
import type { Request } from '../account/api';
const ctx = {
  token: 'synthetic',
  profileId: '00000000-0000-4000-8000-000000000001',
};
const journey = journeySchema.parse({
  id: '00000000-0000-4000-8000-000000000002',
  profileId: ctx.profileId,
  state: 'active',
  mode: 'walk',
  source: { kind: 'fixture', label: 'Synthetic' },
  startedAtMs: 1000,
  finishedAtMs: null,
  preciseExpiresAtMs: 99999,
  captureSessionId: '00000000-0000-4000-8000-000000000003',
  assessment: {
    version: 'test',
    revision: 0,
    calibration: 'unvalidated',
    status: 'unfinished',
    reasons: [],
    startRecorded: false,
    arrivalRecorded: false,
    sampleCount: 0,
  },
});
test('Start sends only request/capture identity; never a client policy, factor, route or approval', async () => {
  const request = jest
    .fn<ReturnType<Request>, Parameters<Request>>()
    .mockResolvedValue(journey);
  await createJourneyApi(request).start(ctx, journey.id, 'request', 'session');
  expect(request).toHaveBeenCalledWith(
    `/v1/journeys/${journey.id}/start`,
    ctx.token,
    'POST',
    { requestId: 'request', captureSessionId: 'session' },
  );
});
test('server calibration status remains readable without the phone granting validation', () => {
  expect(
    journeySchema.parse({
      ...journey,
      assessment: { ...journey.assessment, calibration: 'physical_validated' },
    }).assessment.calibration,
  ).toBe('physical_validated');
});
test('responses from a different profile or journey cannot enter the recorder', async () => {
  for (const value of [
    { ...journey, profileId: '00000000-0000-4000-8000-000000000009' },
    { ...journey, id: '00000000-0000-4000-8000-000000000009' },
  ]) {
    const api = createJourneyApi(async () => value);
    await expect(api.read(ctx, journey.id)).rejects.toThrow('does not match');
  }
});
test('preparation uses one request and rejects foreign candidates before selection', async () => {
  const request = jest
    .fn<ReturnType<Request>, Parameters<Request>>()
    .mockResolvedValue({
      kind: 'prepared',
      candidates: [
        {
          kind: 'prepared',
          routeId: 'route',
          journey: {
            ...journey,
            profileId: '00000000-0000-4000-8000-000000000009',
          },
        },
      ],
    });
  await expect(
    createJourneyApi(request).prepare(ctx, 'request', {
      origin: 'A',
      destination: 'B',
      extraMinutes: 15,
    }),
  ).rejects.toThrow('Foreign');
  expect(request).toHaveBeenCalledTimes(1);
});
