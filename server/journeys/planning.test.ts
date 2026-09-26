import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundarySource } from '../routes/geography.ts';
import type { RouteQueryResult } from '../routes/query.ts';
import { singaporeFactors } from '../../src/features/routes/emissions.ts';
import { planSchema, projectPlanDisplay, routeSnapshots } from './planning.ts';

function comparison(): RouteQueryResult {
  const route = {
    id: 'comparison-only',
    mode: 'bus' as const,
    availability: { kind: 'available' as const },
    distanceMeters: 2000,
    durationSeconds: 900,
    legs: [
      {
        mode: 'bus' as const,
        distanceMeters: 2000,
        durationSeconds: 600,
        description: 'Private stop name',
      },
    ],
  };
  const estimate = {
    kind: 'estimated' as const,
    kgCo2e: 0.14,
    factorIds: ['cag-fy2024-25-bus'],
  };
  return {
    query: {
      origin: 'Private address',
      destination: { latitude: 1.3, longitude: 103.8 },
      modes: ['TRANSIT'],
      extraMinutes: 10,
    },
    result: {
      kind: 'routes',
      source: { kind: 'fixture', label: 'Synthetic comparison' },
      fetchedAt: '2026-09-26T00:00:00.000Z',
      routes: [route],
      outcomes: [{ mode: 'TRANSIT', kind: 'available', count: 1 }],
      evidence: [
        {
          routeId: route.id,
          primaryMode: 'TRANSIT',
          geometry: { kind: 'unavailable', reason: 'missing_geometry' },
          factorApplicability: 'geography_unverified',
        },
      ],
    },
    estimates: [{ routeId: route.id, estimate }],
    // Deliberately authoritative fixture values: projection must not calculate a new ranking.
    recommendation: {
      kind: 'recommended',
      route,
      estimate,
      baseline: {
        kind: 'estimated',
        kgCo2e: 0.34,
        factorIds: ['cag-fy2024-25-car'],
      },
      baselineDistanceMeters: 2000,
      fastestSeconds: 300,
      limitSeconds: 900,
      avoidedKgCo2e: 0.2,
    },
    factors: singaporeFactors,
    geographySource: boundarySource,
    unsupportedModes: ['cab', 'electric_car'],
    calculationStatus: 'indicative_demo',
  };
}

test('display preserves provider total waiting time and authoritative comparison without retaining private route text', () => {
  const response = comparison();
  const display = projectPlanDisplay(response);
  assert.equal(display.routes[0].durationSeconds, 900);
  assert.equal(display.routes[0].legs[0].durationSeconds, 600);
  assert.deepEqual(display.routes[0].estimate, {
    kind: 'estimated',
    kgCo2e: 0.14,
    factorIds: ['cag-fy2024-25-bus'],
  });
  assert.deepEqual(display.recommendation, {
    kind: 'recommended',
    routeId: 'comparison-only',
    estimate: {
      kind: 'estimated',
      kgCo2e: 0.14,
      factorIds: ['cag-fy2024-25-bus'],
    },
    baseline: {
      kind: 'estimated',
      kgCo2e: 0.34,
      factorIds: ['cag-fy2024-25-car'],
    },
    baselineDistanceMeters: 2000,
    fastestSeconds: 300,
    limitSeconds: 900,
    avoidedKgCo2e: 0.2,
  });
  assert.deepEqual(routeSnapshots(response), [
    {
      routeId: 'comparison-only',
      kind: 'unavailable',
      reason: 'missing_geometry',
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(display),
    /Private|latitude|longitude|geometry|description|destination|origin/,
  );
  assert.deepEqual(display.factors, singaporeFactors);
  assert.deepEqual(display.geographySource, boundarySource);
  assert.deepEqual(display.outcomes, [
    { mode: 'TRANSIT', kind: 'available', count: 1 },
  ]);
});

test('display supports accepted comparison distances beyond tracking bounds and enforces route/leg response bounds', () => {
  const response = comparison();
  assert.ok(response.result.kind === 'routes');
  response.result.routes[0].distanceMeters = 2_000_000;
  response.result.routes[0].legs[0].distanceMeters = 2_000_000;
  assert.equal(
    projectPlanDisplay(response).routes[0].distanceMeters,
    2_000_000,
  );
  response.result.routes = Array.from({ length: 13 }, () =>
    response.result.kind === 'routes'
      ? response.result.routes[0]
      : assert.fail(),
  );
  assert.throws(() => projectPlanDisplay(response));
  response.result.routes = [response.result.routes[0]];
  response.result.routes[0].legs = Array.from({ length: 129 }, () => ({
    mode: 'walk',
    distanceMeters: 1,
    durationSeconds: 1,
    description: '',
  }));
  assert.throws(() => projectPlanDisplay(response));
});

test('legacy receipts have explicitly absent display; provider failure has no fabricated routes/source/acquisition', () => {
  assert.deepEqual(
    planSchema.parse({ kind: 'unavailable', reason: 'no_route' }),
    { kind: 'unavailable', reason: 'no_route' },
  );
  assert.equal(
    planSchema.parse({ kind: 'prepared', candidates: [] }).display,
    undefined,
  );
  const response = comparison();
  response.result = {
    kind: 'unavailable',
    reason: 'provider_error',
    outcomes: [
      { kind: 'unavailable', mode: 'TRANSIT', reason: 'provider_error' },
    ],
  };
  response.estimates = [];
  response.recommendation = { kind: 'unavailable', reason: 'no_routes' };
  const display = projectPlanDisplay(response);
  assert.equal(display.source, null);
  assert.equal(display.fetchedAt, null);
  assert.deepEqual(display.routes, []);
  assert.deepEqual(display.recommendation, {
    kind: 'unavailable',
    reason: 'no_routes',
  });
});
