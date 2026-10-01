import assert from 'node:assert/strict';
import { test } from 'node:test';
import { impactRoute } from './testing.ts';
import { fingerprint } from '../awards/readiness.ts';
import { loadDefaultFactorRelease } from '../awards/factors.ts';
import { awardProjection } from '../awards/testing/fixtures.ts';
import { calculateJourneyAward } from '../awards/policy.ts';
import { receiptSchema } from '../awards/contracts.ts';
import { classifyReceipt, summarizeContributions } from './aggregate.ts';

function receipt(legacy = false) {
  const journey = awardProjection();
  if (!legacy) journey.basis = impactRoute().basis;
  const { id, state: _state, ...rest } = journey;
  return receiptSchema.parse({
    ...rest,
    journeyId: id,
    result: calculateJourneyAward(journey),
  });
}
test('empty activity has no fabricated zero', () => {
  assert.deepEqual(summarizeContributions([]), { kind: 'empty' });
});
test('exact approved contributions sum without points, caps or binary rounding', () => {
  assert.deepEqual(
    summarizeContributions([
      { kind: 'eligible', savingsKg: '2' },
      { kind: 'eligible', savingsKg: '3' },
    ]),
    { kind: 'available', savingsKg: '5', journeyCount: 2, excludedJourneys: 0 },
  );
  assert.deepEqual(
    summarizeContributions([
      { kind: 'eligible', savingsKg: '2' },
      { kind: 'eligible', savingsKg: '3' },
      { kind: 'eligible', savingsKg: '4' },
    ]),
    { kind: 'available', savingsKg: '9', journeyCount: 3, excludedJourneys: 0 },
  );
  assert.deepEqual(
    summarizeContributions([
      { kind: 'eligible', savingsKg: '0.1' },
      { kind: 'eligible', savingsKg: '0.2' },
    ]),
    {
      kind: 'available',
      savingsKg: '0.3',
      journeyCount: 2,
      excludedJourneys: 0,
    },
  );
});
test('genuine qualifying zero differs from empty and unavailable', () => {
  assert.deepEqual(
    summarizeContributions([{ kind: 'eligible', savingsKg: '0' }]),
    { kind: 'available', savingsKg: '0', journeyCount: 1, excludedJourneys: 0 },
  );
  assert.deepEqual(
    summarizeContributions([
      { kind: 'unavailable', reason: 'validation_pending' },
    ]),
    { kind: 'unavailable', reasons: ['validation_pending'] },
  );
});
test('fixture receipts never become real contributions; unapproved factors fail closed', () => {
  const stored = receipt();
  assert.deepEqual(classifyReceipt(stored), { kind: 'excluded' });
  stored.source = { kind: 'live', provider: 'synthetic-negative-control' };
  stored.basis.factorStatus = 'indicative_demo';
  assert.deepEqual(classifyReceipt(stored), {
    kind: 'unavailable',
    reason: 'factors_unapproved',
  });
});
test('fallback and unavailable records cannot inflate a partial qualifying total', () => {
  assert.deepEqual(
    summarizeContributions([
      { kind: 'eligible', savingsKg: '2' },
      { kind: 'unavailable', reason: 'insufficient_evidence' },
      { kind: 'excluded' },
    ]),
    { kind: 'available', savingsKg: '2', journeyCount: 1, excludedJourneys: 1 },
  );
});

test('display eligibility is an explicit policy, never inferred from awarded points', () => {
  const stored = receipt();
  stored.source = { kind: 'live', provider: 'synthetic-policy-fixture' };
  stored.basis.factorStatus = 'approved';
  assert.equal(stored.basis.calculation.kind, 'available');
  if (stored.basis.calculation.kind !== 'available') throw new Error('fixture');
  stored.basis.calculation.factors.forEach((factor) => {
    factor.status = 'approved';
  });
  assert.equal(
    classifyReceipt(stored, 'require_readiness').kind,
    'unavailable',
  );
  const allowed = classifyReceipt(stored);
  assert.deepEqual(
    allowed,
    classifyReceipt(stored, 'allow_unvalidated_estimates'),
  );
  assert.equal(allowed.kind, 'eligible');
  assert.equal(stored.result.productionCredit.kind, 'unavailable');
  if (allowed.kind === 'eligible') {
    assert.equal(allowed.savingsKg, '2.4');
    assert.equal(allowed.sources?.length, 2);
  }
  stored.basis.calculation.factors[0].status = 'indicative_demo';
  assert.deepEqual(classifyReceipt(stored, 'allow_unvalidated_estimates'), {
    kind: 'unavailable',
    reason: 'factors_unapproved',
  });
});

test('fallback, unfinished, and missing calculations never become assessed savings under either policy', () => {
  for (const policy of [
    'require_readiness',
    'allow_unvalidated_estimates',
  ] as const) {
    const stored = receipt();
    stored.source = { kind: 'live', provider: 'synthetic-exclusion-test' };
    const decision = stored.result.decision;
    assert.equal(decision.kind, 'full');
    if (decision.kind !== 'full') throw new Error('fixture');
    stored.result.decision = {
      kind: 'fallback',
      calculation: decision.calculation,
      targetPoints: 50,
    };
    assert.deepEqual(classifyReceipt(stored, policy), {
      kind: 'unavailable',
      reason: 'insufficient_evidence',
    });
    stored.result.decision = { kind: 'no_award', reason: 'journey_unfinished' };
    assert.deepEqual(classifyReceipt(stored, policy), { kind: 'excluded' });
    stored.result.decision = {
      kind: 'unavailable',
      reasons: ['missing_or_ambiguous_factor'],
    };
    assert.deepEqual(classifyReceipt(stored, policy), {
      kind: 'unavailable',
      reason: 'calculation_unavailable',
    });
  }
});

test('full decision still requires an actual assessed record, never planned or insufficient evidence', () => {
  const stored = receipt();
  stored.source = { kind: 'live', provider: 'synthetic-assessed-record-test' };
  stored.basis.factorStatus = 'approved';
  if (stored.basis.calculation.kind !== 'available') throw new Error('fixture');
  stored.basis.calculation.factors.forEach((factor) => {
    factor.status = 'approved';
  });
  stored.assessedLegs = {
    kind: 'unavailable',
    reason: 'insufficient_evidence',
  };
  assert.deepEqual(classifyReceipt(stored), {
    kind: 'unavailable',
    reason: 'calculation_unavailable',
  });
  stored.assessedLegs = {
    kind: 'available',
    method: 'gps_single_mode_lower_bound',
    legs: stored.selectedLegs,
  };
  stored.assessment.status = 'insufficient_evidence';
  assert.deepEqual(classifyReceipt(stored), {
    kind: 'unavailable',
    reason: 'insufficient_evidence',
  });
});

test('evidence-rejected finished journeys stay unavailable alone and are counted as excluded beside an estimate', () => {
  const stored = receipt();
  stored.source = {
    kind: 'live',
    provider: 'synthetic-rejected-evidence-test',
  };
  stored.result.decision = {
    kind: 'no_award',
    reason: 'validated_endpoints_required',
  };
  stored.assessment.status = 'insufficient_evidence';
  const rejected = classifyReceipt(stored);
  assert.deepEqual(rejected, {
    kind: 'unavailable',
    reason: 'insufficient_evidence',
  });
  assert.deepEqual(summarizeContributions([rejected]), {
    kind: 'unavailable',
    reasons: ['insufficient_evidence'],
  });
  assert.deepEqual(
    summarizeContributions([rejected, { kind: 'eligible', savingsKg: '2' }]),
    { kind: 'available', savingsKg: '2', journeyCount: 1, excludedJourneys: 1 },
  );
});

test('legacy CO2e is preserved and excluded from explicit CO2 totals', () => {
  const stored = receipt(true);
  stored.source = { kind: 'live', provider: 'synthetic-legacy' };
  stored.basis.factorStatus = 'approved';
  if (stored.basis.calculation.kind !== 'available') throw new Error('fixture');
  stored.basis.calculation.factors.forEach((f) => {
    f.status = 'approved';
  });
  const before = JSON.stringify(stored);
  const contribution = classifyReceipt(stored);
  assert.deepEqual(contribution, {
    kind: 'unavailable',
    reason: 'incompatible_measurement',
  });
  assert.equal(JSON.stringify(stored), before);
  assert.deepEqual(
    summarizeContributions([
      contribution,
      { kind: 'eligible', savingsKg: '2' },
    ]),
    { kind: 'available', savingsKg: '2', journeyCount: 1, excludedJourneys: 1 },
  );
});

test('provisional uses only its actual assessed calculation and remains unvalidated', () => {
  const stored = receipt();
  stored.source = { kind: 'live', provider: 'synthetic-provisional' };
  const decision = stored.result.decision;
  if (decision.kind !== 'full') throw new Error('fixture');
  stored.result.productionCredit = {
    kind: 'provisional',
    policyVersion: 'planned-endpoints-v1',
    factorReleaseVersion: 'synthetic-impact-co2-v1',
  };
  stored.result.decision = {
    kind: 'provisional',
    calculation: { ...decision.calculation, savingsKg: '999' },
    assessedCalculation: decision.calculation,
  };
  const result = classifyReceipt(stored);
  assert.equal(result.kind, 'eligible');
  if (result.kind !== 'eligible') throw new Error('fixture');
  assert.equal(result.savingsKg, '2.4');
  assert.equal(result.validation, 'unvalidated_estimate');
  assert.deepEqual(classifyReceipt(stored, 'require_readiness'), {
    kind: 'unavailable',
    reason: 'validation_pending',
  });
  stored.result.decision.assessedCalculation = null;
  assert.deepEqual(classifyReceipt(stored), {
    kind: 'unavailable',
    reason: 'calculation_unavailable',
  });
});

test('CO2 requires matching approved factor provenance and discloses original units', () => {
  const stored = receipt();
  stored.source = { kind: 'live', provider: 'synthetic-provenance' };
  const result = classifyReceipt(stored);
  assert.equal(result.kind, 'eligible');
  if (result.kind !== 'eligible') throw new Error('fixture');
  assert.equal(result.sources?.[0].sourceUnit, 'kgCO2/vehicle-km');
  assert.equal(result.sources?.[0].publishedUnit, 'kgCO2e/vehicle-km');
  assert.equal(result.sources?.[0].releaseVersion, 'synthetic-impact-co2-v1');
  if (!stored.basis.factorRelease) throw new Error('fixture');
  stored.basis.factorRelease.factorFingerprint = 'b'.repeat(64);
  assert.deepEqual(classifyReceipt(stored), {
    kind: 'unavailable',
    reason: 'factors_unapproved',
  });
  delete stored.basis.factorRelease;
  assert.deepEqual(classifyReceipt(stored), {
    kind: 'unavailable',
    reason: 'factors_unapproved',
  });
});

test('published CAG factors produce explicit assessed CO2 and disclose scope limits', () => {
  const journey = awardProjection();
  const config = loadDefaultFactorRelease();
  journey.source = { kind: 'live', provider: 'synthetic-recorded-journey' };
  if (journey.basis.calculation.kind !== 'available')
    throw new Error('fixture');
  journey.basis.calculation.factors = config.factors;
  journey.basis.factorVersions = config.factors.map((f) => f.id);
  journey.basis.factorStatus = 'approved';
  journey.basis.factorRelease = config.release;
  assert.equal(fingerprint(config.factors), config.release.factorFingerprint);
  const { id, state: _state, ...rest } = journey;
  const stored = receiptSchema.parse({
    ...rest,
    journeyId: id,
    result: calculateJourneyAward(journey),
  });
  const result = classifyReceipt(stored);
  assert.equal(result.kind, 'eligible');
  if (result.kind !== 'eligible') throw new Error('fixture');
  assert.equal(result.savingsKg, '0.1410608');
  assert.ok(
    result.sources?.some(
      (s) =>
        s.assumptions.includes('source') ||
        s.assumptions.includes('Published CO2e'),
    ),
  );
  assert.equal(result.sources?.[0].sourceValue, 0.1901);
  assert.equal(result.sources?.[1].sourceValue, 0.0441);
});
