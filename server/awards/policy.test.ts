import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateJourneyAward } from './policy.ts';
import { awardProjection } from './testing/fixtures.ts';

test('retained decimal policy floors once and caps without claiming production readiness', () => {
  for (const [kg, expected] of [
    [0.0199, 0],
    [0.02, 1],
    [1.16, 58],
    [2.419, 120],
    [10, 500],
    [60, 2000],
  ]) {
    const result = calculateJourneyAward(awardProjection(kg));
    assert.equal(result.decision.kind, 'full');
    assert.ok(result.decision.kind === 'full');
    assert.equal(result.decision.calculation.targetPoints, expected);
    assert.equal(result.decision.calculation.savingsKg, String(kg));
    assert.equal(result.productionCredit.kind, 'unavailable');
    assert.ok(
      result.productionCredit.reasons.includes('calibration_unvalidated'),
    );
  }
});

test('incompatible factor methods remain unavailable instead of producing a numerical award', () => {
  const journey = awardProjection();
  assert.ok(journey.basis.calculation.kind === 'available');
  journey.basis.calculation.factors[1].method =
    'Incompatible lifecycle boundary';
  assert.deepEqual(calculateJourneyAward(journey).decision, {
    kind: 'unavailable',
    reasons: ['incompatible_factor_basis'],
  });
});

test('full award sums supported assessed legs without per-leg rounding or planned-distance substitution', () => {
  const journey = awardProjection(1);
  assert.ok(journey.basis.calculation.kind === 'available');
  journey.basis.calculation.factors[1].kgCo2ePerPassengerKm = 1;
  journey.assessedLegs = {
    kind: 'available',
    method: 'gps_single_mode_lower_bound',
    legs: [
      { mode: 'bus', distanceMeters: 490.1, durationSeconds: 150 },
      { mode: 'bus', distanceMeters: 490.1, durationSeconds: 150 },
    ],
  };
  const decision = calculateJourneyAward(journey).decision;
  assert.ok(decision.kind === 'full');
  assert.deepEqual(decision.calculation, {
    arithmeticVersion: 'floor-decimal-v1',
    baselineKg: '1',
    journeyKg: '0.9802',
    savingsKg: '0.0198',
    targetPoints: 0,
  });
  journey.assessedLegs.legs[0].distanceMeters = 2000;
  const negative = calculateJourneyAward(journey).decision;
  assert.ok(negative.kind === 'full');
  assert.equal(negative.calculation.savingsKg, '0');
  assert.equal(negative.calculation.targetPoints, 0);
});

test('fallback uses expected planned total only with validated endpoints and missing middle evidence', () => {
  for (const [kg, expected] of [
    [2.4, 50],
    [0.4, 20],
    [0, 0],
  ]) {
    const journey = awardProjection(kg);
    journey.assessment.status = 'insufficient_evidence';
    journey.assessment.reasons = ['continuity_gap', 'insufficient_movement'];
    journey.assessedLegs = {
      kind: 'unavailable',
      reason: 'insufficient_evidence',
    };
    const decision = calculateJourneyAward(journey).decision;
    assert.ok(decision.kind === 'fallback');
    assert.equal(decision.targetPoints, expected);
    for (const endpoint of ['startRecorded', 'arrivalRecorded'] as const) {
      journey.assessment[endpoint] = false;
      assert.equal(calculateJourneyAward(journey).decision.kind, 'no_award');
      journey.assessment[endpoint] = true;
    }
    journey.assessment.reasons.push('ambiguous_progression');
    assert.equal(calculateJourneyAward(journey).decision.kind, 'no_award');
  }
});

test('unfinished, contradictory, expired, unsupported and missing bases never become fabricated zero estimates', () => {
  for (const status of ['unfinished', 'ineligible', 'expired'] as const) {
    const journey = awardProjection();
    journey.assessment.status = status;
    assert.equal(calculateJourneyAward(journey).decision.kind, 'no_award');
  }
  const journey = awardProjection();
  journey.assessedLegs = {
    kind: 'unavailable',
    reason: 'multimodal_distances_unknown',
  };
  assert.equal(calculateJourneyAward(journey).decision.kind, 'unavailable');
  journey.assessedLegs = {
    kind: 'available',
    method: 'gps_single_mode_lower_bound',
    legs: journey.selectedLegs,
  };
  assert.ok(journey.basis.calculation.kind === 'available');
  journey.basis.calculation.factors.pop();
  assert.equal(calculateJourneyAward(journey).decision.kind, 'unavailable');
  journey.basis.calculation = {
    kind: 'unavailable',
    reason: 'missing_baseline',
  };
  assert.deepEqual(calculateJourneyAward(journey).decision, {
    kind: 'unavailable',
    reasons: ['missing_baseline'],
  });
});
