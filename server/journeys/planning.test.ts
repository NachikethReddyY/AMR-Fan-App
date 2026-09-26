import { loadDefaultFactorRelease } from '../awards/factors.ts';
import {
  estimateRoute,
  singaporeFactors,
} from '../../src/features/routes/emissions.ts';
import { recommendRoute } from '../../src/features/routes/recommendation.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundarySource } from '../routes/geography.ts';
import type { RouteQueryResult } from '../routes/query.ts';
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

test('prepared route retains reviewed factor provenance from the single comparison response', () => {
  const response = comparison();
  assert.ok(response.result.kind === 'routes');
  const bus = response.result.routes[0];
  const car = {
    ...bus,
    id: 'baseline',
    mode: 'car' as const,
    legs: [{ ...bus.legs[0], mode: 'car' as const }],
  };
  response.result.routes.push(car);
  response.estimates.push({
    routeId: car.id,
    estimate: response.estimates[0].estimate,
  });
  response.result.evidence = [bus, car].map((route) => ({
    routeId: route.id,
    primaryMode: route.mode === 'car' ? 'DRIVE' : 'TRANSIT',
    geometry: {
      kind: 'provider',
      encoding: 'google-polyline5',
      start: { latitude: 1.3, longitude: 103.8 },
      end: { latitude: 1.31, longitude: 103.8 },
      points: [
        { latitude: 1.3, longitude: 103.8 },
        { latitude: 1.31, longitude: 103.8 },
      ],
    },
    factorApplicability: 'singapore_indicative',
  }));
  response.calculationStatus = 'approved';
  response.factorRelease = {
    version: 'synthetic-review-v1',
    factorFingerprint: 'a'.repeat(64),
    geographyVersion: response.geographySource.id,
    factorEvidence: {
      reference: 'Synthetic test only',
      sha256: 'b'.repeat(64),
      boundary: 'use_phase_co2e',
      baseline: 'single_occupant_ice',
      compatibility: 'Synthetic fixture',
      units: [
        {
          factorId: response.factors[0].id,
          sourceValue: 0,
          sourceUnit: 'kgCO2e/passenger-km',
          occupants: 1,
        },
      ],
    },
  };
  const snapshots = routeSnapshots(response);
  assert.equal(snapshots.length, 2);
  for (const result of snapshots) {
    assert.ok(result.kind === 'available');
    assert.deepEqual(
      result.snapshot.basis.factorRelease,
      response.factorRelease,
    );
    assert.equal(result.snapshot.basis.factorStatus, 'approved');
  }
  const display = projectPlanDisplay(response);
  assert.equal(display.calculationStatus, 'approved');
});

test('single comparison projects explicit CO2 display and retains exact factor release', () => {
  const response = comparison();
  assert.ok(response.result.kind === 'routes');
  const config = loadDefaultFactorRelease();
  const bus = response.result.routes[0];
  response.result.routes.push({
    ...bus,
    id: 'car',
    mode: 'car',
    legs: bus.legs.map((leg) => ({ ...leg, mode: 'car' })),
  });
  response.factors = config.factors;
  response.factorRelease = config.release;
  response.calculationStatus = 'approved';
  response.estimates = response.result.routes.map((route) => ({
    routeId: route.id,
    estimate: estimateRoute(route, config.factors),
  }));
  response.recommendation = recommendRoute(
    response.result.routes,
    10,
    config.factors,
  );
  const display = projectPlanDisplay(response);
  assert.equal(display.calculationStatus, 'approved');
  assert.equal(display.routes[0].estimate.kind, 'estimated_co2');
  assert.equal(display.recommendation.kind, 'recommended_co2');
  assert.deepEqual(display.factors, config.factors);
  const retained = planSchema.parse({
    kind: 'prepared',
    display,
    candidates: [],
  });
  assert.deepEqual(retained.display, display);
});

test('prepared snapshot keeps the selected provider leg geometry without changing its distances', () => {
  const value = comparison();
  if (value.result.kind !== 'routes') throw new Error('Missing fixture');
  const start = { latitude: 1.3, longitude: 103.8 };
  const end = { latitude: 1.31, longitude: 103.8 };
  const geometry = {
    kind: 'provider' as const,
    legs: [{ legIndex: 0, points: [start, end] }],
  };
  value.result.evidence[0].geometry = {
    kind: 'provider',
    start,
    end,
    points: [start, end],
    encoding: 'google-polyline5',
  };
  value.result.evidence[0].legGeometry = geometry;
  const snapshot = routeSnapshots(value)[0];
  assert.equal(snapshot.kind, 'available');
  if (snapshot.kind === 'available') {
    assert.deepEqual(snapshot.snapshot.legGeometry, geometry);
    assert.equal(snapshot.snapshot.legs[0].distanceMeters, 2000);
  }
});
