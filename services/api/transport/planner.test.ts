import assert from 'node:assert/strict';
import { test } from 'node:test';
import { departures, planTransport } from './planner.ts';
import { planInput } from './contracts.ts';

const at = '2026-10-04T10:07:00+08:00';
const input = (extra: Record<string, unknown> = {}) =>
  planInput.parse({
    origin: 'orchard',
    destination: 'city-hall',
    departAt: at,
    ...extra,
  });

test('five-minute services preserve terminal phase and downstream offsets', () => {
  const first = departures({
    stopId: 'orchard',
    mode: 'train',
    at,
    scenario: 'normal',
  });
  assert.equal(first.source.kind, 'simulated');
  assert.deepEqual(
    first.departures.slice(0, 2).map((d) => d.departsAt),
    ['2026-10-04T02:10:00.000Z', '2026-10-04T02:15:00.000Z'],
  );
  const downstream = departures({
    stopId: 'dhoby-ghaut',
    mode: 'train',
    at,
    scenario: 'normal',
  });
  assert.ok(
    downstream.departures.some(
      (d) =>
        d.direction === 'marina-bay' &&
        d.departsAt === '2026-10-04T02:09:00.000Z',
    ),
  );
});

test('service starts tomorrow after the last terminal departure; offsets cross midnight correctly', () => {
  const result = departures({
    stopId: 'orchard',
    mode: 'train',
    at: '2026-10-04T23:59:00+08:00',
    scenario: 'normal',
  });
  assert.equal(result.departures[0].departsAt, '2026-10-04T22:00:00.000Z');
});

test('journey duration includes waiting and sequential walking/transfer legs', async () => {
  const result = await planTransport(input());
  const train = result.routes.find((r) => r.mode === 'train');
  assert.ok(train);
  assert.equal(train.arrivesAt, '2026-10-04T02:18:00.000Z');
  assert.equal(train.durationSeconds, 660);
  assert.equal(train.waitSeconds, 60);
  assert.equal(train.source.kind, 'simulated');
  assert.equal(result.awardEligible, false);
  assert.ok(
    result.unavailable.some(
      (r) => r.mode === 'car' && r.reason === 'road_router_not_configured',
    ),
  );
  for (const route of result.routes) {
    assert.equal(
      route.durationSeconds,
      route.legs.reduce((sum, l) => sum + l.durationSeconds, 0),
    );
    for (let i = 1; i < route.legs.length; i++)
      assert.equal(route.legs[i].startsAt, route.legs[i - 1].endsAt);
  }
});

test('mixed public transport combines a train and a bus', async () => {
  const result = await planTransport({
    origin: 'orchard',
    destination: 'bayfront',
    departAt: '2026-10-04T10:07:00+08:00',
  });
  const mixed = result.routes.find((route) => route.mode === 'transit');
  assert.ok(mixed);
  assert.deepEqual(
    mixed.legs.filter((item) => item.kind === 'ride').map((item) => item.mode),
    ['train', 'bus'],
  );
  assert.equal(mixed.transfers, 1);
});

test('one transfer follows the next actual demo departure after the transfer buffer', async () => {
  const result = await planTransport(input({ destination: 'bayfront' }));
  const train = result.routes.find((r) => r.mode === 'train');
  assert.ok(train);
  assert.equal(train.transfers, 1);
  assert.ok(
    train.legs.some((l) => l.kind === 'transfer' && l.durationSeconds === 120),
  );
  assert.equal(train.legs.filter((l) => l.kind === 'ride').length, 2);
});

test('deadline and disruption outcomes never recommend an option arriving late', async () => {
  const tight = await planTransport(
    input({ arriveBy: '2026-10-04T10:08:00+08:00' }),
  );
  assert.equal(tight.recommendation.kind, 'unavailable');
  assert.ok(tight.routes.every((r) => r.meetsDeadline === false));
  const normal = await planTransport(input());
  const delayed = await planTransport(input({ scenario: 'train-delay' }));
  assert.notEqual(
    normal.routes.find((r) => r.mode === 'train')?.arrivesAt,
    delayed.routes.find((r) => r.mode === 'train')?.arrivesAt,
  );
  const cancelled = await planTransport(input({ scenario: 'train-cancelled' }));
  assert.ok(!cancelled.routes.some((r) => r.mode === 'train'));
  assert.ok(cancelled.routes.some((r) => r.mode === 'bus'));
});

test('unknown places, same endpoints, invalid times and unsupported coverage stay honest', async () => {
  const unknown = await planTransport(input({ origin: 'made-up place' }));
  assert.equal(unknown.routes.length, 0);
  assert.equal(unknown.recommendation.kind, 'unavailable');
  const outside = await planTransport(
    input({ origin: { latitude: 51.5, longitude: -0.1 } }),
  );
  assert.equal(outside.routes.length, 0);
  const same = await planTransport(input({ destination: 'orchard' }));
  assert.equal(same.routes.length, 0);
  for (const change of [
    { departAt: '10:07' },
    { departAt: '2026-02-30T10:07:00Z' },
    { arriveBy: '2026-10-04T10:06:00+08:00' },
    { scenario: 'arbitrary' },
    { modes: ['train', 'train'] },
    { origin: { latitude: Infinity, longitude: 0 } },
    { origin: 'orchard', endpoint: 'http://private.invalid' },
  ])
    assert.equal(
      planInput.safeParse({
        origin: 'orchard',
        destination: 'city-hall',
        departAt: at,
        ...change,
      }).success,
      false,
    );
});

test('coordinate places produce a shared map-ready plan for native clients', async () => {
  const result = await planTransport({
    origin: { latitude: 1.3048, longitude: 103.8329 },
    destination: { latitude: 1.2816, longitude: 103.8602 },
    departAt: at,
    modes: ['transit', 'walk'],
  });
  assert.ok(result.routes.some((route) => route.mode === 'transit'));
  assert.ok(result.routes.some((route) => route.mode === 'walk'));
  for (const route of result.routes) {
    assert.ok(route.legs.every((item) => item.fromCoordinate && item.toCoordinate));
    assert.ok(route.distanceMeters && route.distanceMeters > 0);
  }
});
