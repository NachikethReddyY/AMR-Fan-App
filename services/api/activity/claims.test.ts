import assert from 'node:assert/strict';
import { test } from 'node:test';
import { photoAward, remainingJourneyAward } from './policy.ts';

test('code awards exactly 50 only for supported confidence strictly above 0.5', () => {
  for (const confidence of [null, 0, 0.5, Number.NaN, 1.1])
    assert.equal(photoAward({ verdict: 'supported', confidence }), 0);
  for (const verdict of ['uncertain', 'not-supported'])
    assert.equal(photoAward({ verdict, confidence: 1 }), 0);
  assert.equal(photoAward({ verdict: 'supported', confidence: 0.50001 }), 50);
});
test('preliminary and cumulative journey credit never pay twice or claw back', () => {
  assert.equal(remainingJourneyAward(120, 0, 50), 70);
  assert.equal(remainingJourneyAward(120, 120, 50), 0);
  assert.equal(remainingJourneyAward(30, 0, 50), 0);
  assert.equal(remainingJourneyAward(120, 0, 0), 120);
  assert.equal(remainingJourneyAward(200, 120, 50), 80);
});
