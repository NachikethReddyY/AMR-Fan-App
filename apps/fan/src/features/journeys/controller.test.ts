import { createJourneyController } from './controller';
import { planSchema, type Plan } from './contracts';
const ctx = {
  token: 'synthetic',
  profileId: '00000000-0000-4000-8000-000000000001',
};
const query = { origin: 'A', destination: 'B', extraMinutes: 15 };
const plan: Plan = { kind: 'unavailable', reason: 'live_not_configured' };
test('preparation retry keeps the request identity and original comparison query', async () => {
  const prepare = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(plan);
  const c = createJourneyController(prepare, () => 'request-1', jest.fn());
  await c.compare(ctx, query);
  await c.compare(ctx, query);
  expect(prepare.mock.calls[1]).toEqual(prepare.mock.calls[0]);
});
test('clearing or changing profile discards a delayed prepared journey', async () => {
  let resolve: (value: Plan) => void = () => {};
  const c = createJourneyController(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
    () => 'request',
    jest.fn(),
  );
  const pending = c.compare(ctx, query);
  c.clear();
  resolve(plan);
  await pending;
  expect(c.getState().kind).toBe('idle');
});
test('a new explicit comparison after a received result gets a fresh server query identity', async () => {
  const prepare = jest.fn().mockResolvedValue(plan);
  let id = 0;
  const c = createJourneyController(
    prepare,
    () => `request-${++id}`,
    jest.fn(),
  );
  await c.compare(ctx, query);
  await c.compare(ctx, query);
  expect(prepare.mock.calls.map((call) => call[1])).toEqual([
    'request-1',
    'request-2',
  ]);
});
test('prepared CO2 recommendation survives projection without becoming a legacy CO2e recommendation', async () => {
  const estimate = {
    kind: 'estimated_co2',
    gas: 'CO2',
    unit: 'kgCO2',
    kg: 0,
    factorIds: ['co2-walk'],
  };
  const value = planSchema.parse({
    kind: 'prepared',
    candidates: [],
    display: {
      version: 1,
      source: { kind: 'fixture', label: 'Synthetic' },
      fetchedAt: '2026-09-26T00:00:00.000Z',
      extraMinutes: 15,
      routes: [
        {
          routeId: 'walk-1',
          mode: 'walk',
          availability: { kind: 'available' },
          distanceMeters: 1000,
          durationSeconds: 600,
          legs: [{ mode: 'walk', distanceMeters: 1000, durationSeconds: 600 }],
          estimate,
        },
      ],
      recommendation: {
        kind: 'recommended_co2',
        gas: 'CO2',
        unit: 'kgCO2',
        routeId: 'walk-1',
        estimate,
        baseline: { ...estimate, kg: 0.1901 },
        baselineDistanceMeters: 1000,
        fastestSeconds: 300,
        limitSeconds: 1200,
        avoidedKg: 0.1901,
      },
      outcomes: [],
    },
  });
  const c = createJourneyController(
    async () => value,
    () => 'request',
    jest.fn(),
  );
  await c.compare(ctx, query);
  const result = c.getState();
  if (result.kind !== 'ready') throw new Error('No comparison');
  expect(result.value.recommendation).toMatchObject({
    kind: 'recommended_co2',
    gas: 'CO2',
    unit: 'kgCO2',
    avoidedKg: 0.1901,
  });
  expect(result.value.recommendation).not.toHaveProperty('avoidedKgCo2e');
});
