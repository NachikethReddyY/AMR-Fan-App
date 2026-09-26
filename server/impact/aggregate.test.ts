import assert from 'node:assert/strict';
import { test } from 'node:test';
import { awardProjection } from '../awards/testing/fixtures.ts';
import { calculateJourneyAward } from '../awards/policy.ts';
import { receiptSchema } from '../awards/contracts.ts';
import { classifyReceipt, summarizeContributions } from './aggregate.ts';

function receipt() {
  const journey = awardProjection();
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
