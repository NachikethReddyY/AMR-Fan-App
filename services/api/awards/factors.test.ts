import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadFactorRelease, fingerprint } from './readiness.ts';
import { estimateRoute, singaporeFactors } from '@amr/travel-domain/emissions';
import { recommendRoute } from '@amr/travel-domain/recommendation';
import { planDisplaySchema } from '../journeys/planning.ts';
import type { RouteOption } from '@amr/travel-domain/routes';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadDefaultFactorRelease } from './factors.ts';
import { calculateJourneyAward } from './policy.ts';
import { awardProjection } from './testing/fixtures.ts';

test('accepted CAG factor release keeps explicit CO2 units and exact published values', () => {
  const config = loadDefaultFactorRelease();
  assert.equal(config.release.version, 'cag-surface-access-co2-v1');
  assert.equal(
    config.release.factorEvidence.boundary,
    'published_surface_access',
  );
  assert.equal(config.release.factorEvidence.baseline, 'single_occupant_car');
  assert.deepEqual(
    config.factors.map((f) => [
      f.mode,
      'kgPerPassengerKm' in f ? f.kgPerPassengerKm : null,
    ]),
    [
      ['car', 0.1901],
      ['bus', 0.0441],
      ['train', 0.0578],
      ['walk', 0],
      ['cycle', 0],
    ],
  );
  for (const factor of config.factors) {
    assert.ok('gas' in factor);
    assert.equal(factor.gas, 'CO2');
    assert.equal(factor.unit, 'kgCO2/passenger-km');
    assert.equal('kgCo2ePerPassengerKm' in factor, false);
  }
});

test('CO2 provisional receipt separates planned and assessed amounts and preserves legacy CO2e receipts', () => {
  const config = loadDefaultFactorRelease();
  const journey = awardProjection();
  assert.ok(journey.basis.calculation.kind === 'available');
  journey.source = { kind: 'live', provider: 'synthetic-route-test' };
  journey.basis.calculation.factors = config.factors;
  journey.basis.factorRelease = config.release;
  journey.basis.factorVersions = config.factors.map((f) => f.id);
  journey.basis.factorStatus = 'approved';
  journey.routeEvidence.geographyVersion = config.release.geographyVersion;
  journey.awardPolicy = {
    kind: 'provisional',
    version: 'planned-endpoints-v1',
  };
  journey.selectedLegs = [
    { mode: 'bus', distanceMeters: 10000, durationSeconds: 600 },
  ];
  journey.basis.calculation.baseline.legs = [
    { mode: 'car', distanceMeters: 10000, durationSeconds: 600 },
  ];
  journey.assessedLegs = {
    kind: 'available',
    method: 'gps_single_mode_lower_bound',
    legs: [{ mode: 'bus', distanceMeters: 9000, durationSeconds: 600 }],
  };
  const result = calculateJourneyAward(journey);
  assert.equal(result.productionCredit.kind, 'provisional');
  assert.ok(result.decision.kind === 'provisional');
  assert.deepEqual(result.decision.calculation.measurement, {
    version: 'cag-surface-access-co2-v1',
    gas: 'CO2',
    unit: 'kgCO2',
  });
  assert.equal(result.decision.calculation.savingsKg, '1.46');
  assert.equal(result.decision.calculation.targetPoints, 73);
  assert.equal(result.decision.assessedCalculation?.savingsKg, '1.5041');
  const legacy = calculateJourneyAward(awardProjection());
  assert.ok(legacy.decision.kind === 'full');
  assert.equal('measurement' in legacy.decision.calculation, false);
});

function route(mode: 'car' | 'bus' | 'train'): RouteOption {
  return {
    id: mode,
    mode,
    availability: { kind: 'available' },
    distanceMeters: 10000,
    durationSeconds: 600,
    legs: [
      { mode, distanceMeters: 10000, durationSeconds: 600, description: mode },
    ],
  };
}
test('CO2 route estimates and recommendation keep explicit units and reject mixed-gas ranking', () => {
  const { factors } = loadDefaultFactorRelease();
  const bus = estimateRoute(route('bus'), factors);
  assert.deepEqual(bus, {
    kind: 'estimated_co2',
    gas: 'CO2',
    unit: 'kgCO2',
    kg: 0.441,
    factorIds: ['cag-surface-access-co2-v1-bus'],
  });
  const recommendation = recommendRoute(
    [route('car'), route('bus'), route('train')],
    0,
    factors,
  );
  assert.ok(recommendation.kind === 'recommended_co2');
  assert.equal(recommendation.route.id, 'bus');
  assert.equal(recommendation.gas, 'CO2');
  assert.equal(recommendation.unit, 'kgCO2');
  assert.ok(Math.abs(recommendation.avoidedKg - 1.46) < 1e-12);
  const schema = planDisplaySchema.shape.recommendation;
  const { route: selected, ...rest } = recommendation;
  const display = { ...rest, routeId: selected.id };
  assert.ok(schema.safeParse(display).success);
  assert.equal(schema.safeParse({ ...display, unit: 'kgCO2e' }).success, false);
  assert.equal(
    schema.safeParse({
      ...display,
      baseline: { kind: 'estimated', kgCo2e: 1.901, factorIds: [] },
    }).success,
    false,
  );
  const legacy = estimateRoute(route('bus'), singaporeFactors);
  assert.ok(legacy.kind === 'estimated');
  const mixed = [factors[0], singaporeFactors.find((f) => f.mode === 'bus')!];
  const mixRoute = {
    ...route('bus'),
    legs: [...route('car').legs, ...route('bus').legs],
  };
  assert.deepEqual(estimateRoute(mixRoute, mixed), {
    kind: 'unavailable',
    reason: 'incompatible_gases',
  });
  const ranked = recommendRoute([route('car'), route('bus')], 0, mixed);
  assert.ok(ranked.kind === 'recommended_co2');
  assert.equal(ranked.route.id, 'car');
});

test('CO2 configuration rejects gas relabelling, occupancy invention, changed factors and changed evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'amr-co2-factor-'));
  const original = {
    ...loadDefaultFactorRelease(),
    evidenceFile: 'cag-surface-access-co2-v1.md',
  };
  try {
    copyFileSync(
      new URL('./factors/cag-surface-access-co2-v1.md', import.meta.url),
      join(directory, original.evidenceFile),
    );
    const path = join(directory, 'factors.json');
    for (const mutate of [
      (c: typeof original) => {
        Object.assign(c.factors[0], { gas: 'CO2e' });
      },
      (c: typeof original) => {
        c.release.factorEvidence.units[0].occupants = 2;
      },
      (c: typeof original) => {
        c.release.factorEvidence.units[0].sourceUnit = 'kgCO2/passenger-km';
      },
      (c: typeof original) => {
        assert.ok('kgPerPassengerKm' in c.factors[0]);
        c.factors[0].kgPerPassengerKm = 0.2;
      },
      (c: typeof original) => {
        c.release.factorEvidence.units[1].sourceValue = 0.07;
      },
      (c: typeof original) => {
        c.factors[1].status = 'indicative_demo';
      },
    ]) {
      const c = structuredClone(original);
      mutate(c);
      c.release.factorFingerprint = fingerprint(c.factors);
      writeFileSync(path, JSON.stringify(c));
      assert.throws(() => loadFactorRelease(path));
    }
    writeFileSync(path, JSON.stringify(original));
    writeFileSync(join(directory, original.evidenceFile), 'changed');
    assert.throws(() => loadFactorRelease(path), /digest/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('CO2 policy requires exact retained dataset and recorded endpoints, with no invented physical release', () => {
  const config = loadDefaultFactorRelease();
  const journey = awardProjection();
  assert.ok(journey.basis.calculation.kind === 'available');
  journey.basis.calculation.factors = config.factors;
  journey.basis.factorRelease = config.release;
  journey.basis.factorStatus = 'approved';
  journey.basis.factorVersions = config.factors.map((f) => f.id);
  journey.routeEvidence.geographyVersion = config.release.geographyVersion;
  journey.source = { kind: 'live', provider: 'synthetic-test' };
  // The full decision can estimate assessed CO2 before physical release, without points readiness.
  const full = calculateJourneyAward(journey);
  assert.equal(full.decision.kind, 'full');
  assert.equal(full.productionCredit.kind, 'unavailable');
  journey.awardPolicy = {
    kind: 'provisional',
    version: 'planned-endpoints-v1',
  };
  journey.assessment.status = 'insufficient_evidence';
  journey.assessment.reasons = ['continuity_gap'];
  const fallback = calculateJourneyAward(journey);
  assert.ok(fallback.decision.kind === 'fallback');
  assert.equal(fallback.decision.targetPoints, 7);
  for (const endpoint of ['startRecorded', 'arrivalRecorded'] as const) {
    journey.assessment[endpoint] = false;
    assert.equal(
      calculateJourneyAward(journey).productionCredit.kind,
      'unavailable',
    );
    journey.assessment[endpoint] = true;
  }
  const factor = journey.basis.calculation.factors[0];
  assert.ok('kgPerPassengerKm' in factor);
  factor.kgPerPassengerKm += 0.01;
  assert.equal(calculateJourneyAward(journey).decision.kind, 'unavailable');
});
