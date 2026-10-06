import assert from 'node:assert/strict';
import { test } from 'node:test';
import { departures, planTransport } from './planner.ts';
import { estimatePlanRoutes, recommendTransport } from './estimates.ts';
import {
  planInput,
  type TransportEstimate,
  type TransportRoute,
} from './contracts.ts';
import type { ProviderResult } from '../routes/provider.ts';

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
    assert.ok(
      route.legs.every((item) => item.fromCoordinate && item.toCoordinate),
    );
    assert.ok(route.distanceMeters && route.distanceMeters > 0);
  }
});

test('transport plans estimate every route and recommend lowest emissions in tolerance', async () => {
  const result = await planTransport({
    origin: { latitude: 1.3048, longitude: 103.8329 },
    destination: { latitude: 1.2816, longitude: 103.8602 },
    departAt: at,
    modes: ['transit', 'walk'],
  });
  assert.equal(result.estimates.length, result.routes.length);
  for (const item of result.estimates) {
    assert.equal(item.distanceMethod, 'straight_line');
    assert.equal(item.estimate.kind, 'estimated');
  }
  const transit = result.estimates.find((item) =>
    item.routeId.includes('transit'),
  );
  assert.ok(
    transit?.estimate.kind === 'estimated' && transit.estimate.kgCo2e > 0,
  );
  assert.equal(result.recommendation.kind, 'recommended');
  if (result.recommendation.kind === 'recommended') {
    assert.ok(result.recommendation.routeId.includes('transit'));
    assert.match(result.recommendation.reason, /Lowest estimated emissions/);
  }
});

test('simulated stop routes estimate with zero-factor walks despite unknown walk endpoints', async () => {
  const result = await planTransport(input());
  const train = result.routes.find((r) => r.mode === 'train');
  assert.ok(train);
  const estimate = result.estimates.find(
    (item) => item.routeId === train.id,
  )?.estimate;
  assert.equal(estimate?.kind, 'estimated');
});

test('live routes without leg geometry share the provider total by duration', async () => {
  const base = {
    source: { kind: 'live', provider: 'test', dataFreshness: at },
    waitSeconds: 0,
    transfers: 1,
    arrivesAt: at,
    meetsDeadline: true,
  } as const;
  const leg = (
    mode: 'train' | 'bus',
    durationSeconds: number,
  ): TransportRoute['legs'][number] => ({
    kind: 'ride',
    mode,
    from: 'Transfer',
    to: 'MRT/LRT',
    startsAt: at,
    endsAt: at,
    durationSeconds,
    description: 'Ride',
    instruction: null,
    fromCoordinate: null,
    toCoordinate: null,
    path: null,
  });
  const route: TransportRoute = {
    ...base,
    id: 'live-mixed',
    mode: 'transit',
    legs: [leg('train', 500), leg('bus', 300)],
    durationSeconds: 800,
    distanceMeters: 6100,
  };
  const [item] = estimatePlanRoutes([route]);
  assert.equal(item.distanceMethod, 'apportioned');
  assert.equal(item.estimate.kind, 'estimated');
  if (item.estimate.kind === 'estimated') {
    const expected = 3.8125 * 0.01 + 2.2875 * 0.07;
    assert.ok(Math.abs(item.estimate.kgCo2e - expected) < 1e-9);
    assert.deepEqual(item.estimate.factorIds, [
      'cag-fy2024-25-mrt',
      'cag-fy2024-25-bus',
    ]);
  }
});
test('travel behavior scenarios pick viable, dominant and cleaner options', () => {
  const tRoute = (
    id: string,
    mode: TransportRoute['mode'],
    durationSeconds: number,
  ): TransportRoute => ({
    id,
    mode,
    source: { kind: 'simulated', label: 'test', dataFreshness: at },
    legs: [],
    durationSeconds,
    waitSeconds: 0,
    transfers: 0,
    arrivesAt: at,
    meetsDeadline: true,
    distanceMeters: 1000,
  });
  const tEst = (routeId: string, kg: number): TransportEstimate => ({
    routeId,
    estimate: { kind: 'estimated', kgCo2e: kg, factorIds: [] },
    distanceMethod: 'straight_line',
  });
  const pick = (routes: TransportRoute[], kgs: number[], extraMinutes = 15) => {
    const estimates = routes.map((route, index) => tEst(route.id, kgs[index]));
    return recommendTransport(routes, estimates, extraMinutes, undefined);
  };
  // A 33-minute walk stays listed but can never win, even at zero.
  const capped = pick(
    [tRoute('car', 'car', 1800), tRoute('walk', 'walk', 2000)],
    [3.0, 0],
  );
  assert.equal(capped.kind, 'recommended');
  if (capped.kind === 'recommended') assert.equal(capped.routeId, 'car');
  // A car that is five times faster than transit wins; nothing greener is viable.
  const dominant = pick(
    [tRoute('car', 'car', 1200), tRoute('train', 'train', 7200)],
    [2.0, 0.1],
  );
  assert.equal(dominant.kind, 'recommended');
  if (dominant.kind === 'recommended') {
    assert.equal(dominant.routeId, 'car');
    assert.match(
      dominant.reason,
      /Lowest estimated emissions and the fastest option/,
    );
  }
  // A cleaner car beats a dirtier bus on emissions, not just speed.
  const cleaner = pick(
    [tRoute('car', 'car', 600), tRoute('bus', 'bus', 700)],
    [0.5, 0.9],
  );
  assert.equal(cleaner.kind, 'recommended');
  if (cleaner.kind === 'recommended') {
    assert.equal(cleaner.routeId, 'car');
    assert.match(cleaner.reason, /Lowest estimated emissions/);
  }
  // Near-tie on emissions breaks toward the faster ride.
  const tie = pick(
    [tRoute('bus', 'bus', 700), tRoute('train', 'train', 800)],
    [0.5, 0.5],
  );
  assert.equal(tie.kind, 'recommended');
  if (tie.kind === 'recommended') assert.equal(tie.routeId, 'bus');
});
test('live provider leg shapes reach transport legs for map drawing', async () => {
  const pt = (latitude: number, longitude: number) => ({ latitude, longitude });
  const providerResult: ProviderResult = {
    kind: 'routes',
    source: { kind: 'live', provider: 'test' },
    routes: [
      {
        id: 'pt-0',
        mode: 'train',
        availability: { kind: 'available' },
        legs: [
          {
            mode: 'walk',
            distanceMeters: 200,
            durationSeconds: 150,
            description: 'Walk',
          },
          {
            mode: 'train',
            distanceMeters: 3000,
            durationSeconds: 400,
            description: 'MRT/LRT',
          },
        ],
        distanceMeters: 3200,
        durationSeconds: 550,
      },
    ],
    outcomes: [],
    evidence: [
      {
        routeId: 'pt-0',
        primaryMode: 'TRANSIT',
        geometry: { kind: 'unavailable', reason: 'missing_geometry' },
        legGeometry: { kind: 'unavailable', reason: 'missing_geometry' },
        legShapes: [
          {
            legIndex: 0,
            points: [pt(1.3, 103.8), pt(1.301, 103.801)],
          },
          {
            legIndex: 1,
            points: [pt(1.305, 103.81), pt(1.31, 103.82), pt(1.315, 103.83)],
          },
        ],
        factorApplicability: 'geography_unverified',
      },
    ],
    fetchedAt: at,
  };
  const result = await planTransport(
    {
      origin: { latitude: 1.3, longitude: 103.8 },
      destination: { latitude: 1.315, longitude: 103.83 },
      departAt: at,
    },
    { liveRouteProvider: { search: async () => providerResult } },
  );
  assert.equal(result.routes.length, 1);
  const legs = result.routes[0].legs;
  assert.equal(legs.length, 2);
  assert.deepEqual(legs[0].path, [
    { latitude: 1.3, longitude: 103.8 },
    { latitude: 1.301, longitude: 103.801 },
  ]);
  assert.deepEqual(legs[1].path, [
    { latitude: 1.305, longitude: 103.81 },
    { latitude: 1.31, longitude: 103.82 },
    { latitude: 1.315, longitude: 103.83 },
  ]);
});
test('unmeasurable legs stay unavailable; fallback recommends fastest', async () => {
  const legBase = {
    startsAt: at,
    endsAt: at,
    description: 'Leg',
    instruction: null,
    path: null,
  };
  const routeBase = {
    source: { kind: 'simulated', label: 'test', dataFreshness: at },
    waitSeconds: 0,
    transfers: 0,
    arrivesAt: at,
    meetsDeadline: true,
  } as const;
  const fast: TransportRoute = {
    ...routeBase,
    id: 'fast',
    mode: 'transit',
    legs: [
      {
        ...legBase,
        kind: 'ride',
        mode: 'transit',
        from: 'a',
        to: 'b',
        durationSeconds: 600,
        fromCoordinate: { latitude: 1.3, longitude: 103.8 },
        toCoordinate: { latitude: 1.31, longitude: 103.81 },
      },
    ],
    durationSeconds: 600,
    distanceMeters: 1500,
  };
  const slowWalk: TransportRoute = {
    ...routeBase,
    id: 'slow-walk',
    mode: 'walk',
    legs: [
      {
        ...legBase,
        kind: 'walk',
        mode: 'walk',
        from: 'a',
        to: 'b',
        durationSeconds: 900,
        fromCoordinate: null,
        toCoordinate: null,
      },
    ],
    durationSeconds: 900,
    distanceMeters: 1200,
  };
  const slowBus: TransportRoute = {
    ...routeBase,
    id: 'slow-bus',
    mode: 'bus',
    legs: [
      {
        ...legBase,
        kind: 'ride',
        mode: 'bus',
        from: 'a',
        to: 'b',
        durationSeconds: 900,
        fromCoordinate: null,
        toCoordinate: null,
      },
    ],
    durationSeconds: 900,
    distanceMeters: null,
  };
  const estimates = estimatePlanRoutes([fast, slowWalk, slowBus]);
  assert.deepEqual(
    estimates.find((item) => item.routeId === 'fast')?.estimate,
    { kind: 'unavailable', reason: 'missing_factor', mode: 'transit' },
  );
  assert.deepEqual(
    estimates.find((item) => item.routeId === 'slow-bus')?.estimate,
    { kind: 'unavailable', reason: 'invalid_route' },
  );
  assert.equal(
    estimates.find((item) => item.routeId === 'slow-walk')?.estimate.kind,
    'estimated',
  );
  const ranked = recommendTransport([fast, slowWalk], estimates, 15, undefined);
  assert.equal(ranked.kind, 'recommended');
  if (ranked.kind === 'recommended') {
    assert.equal(ranked.routeId, 'slow-walk');
    assert.match(ranked.reason, /Lowest estimated emissions/);
  }
  const fallback = recommendTransport(
    [fast, slowBus],
    estimates,
    15,
    undefined,
  );
  assert.equal(fallback.kind, 'recommended');
  if (fallback.kind === 'recommended') {
    assert.equal(fallback.routeId, 'fast');
    assert.match(fallback.reason, /Earliest arrival/);
  }
});
