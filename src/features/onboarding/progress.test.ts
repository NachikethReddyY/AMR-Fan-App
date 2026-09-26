import { expect, test } from '@jest/globals';
import { onboardingStage, progressFraction } from './progress';

test('introduction precedes account setup, then an unnamed profile needs a name', () => {
  expect(onboardingStage(false, false, false)).toBe('intro');
  expect(onboardingStage(true, false, false)).toBe('account');
  expect(onboardingStage(true, true, false)).toBe('name');
  expect(onboardingStage(true, true, true)).toBe('complete');
});

test('progress reflects completed steps and never announces completion early', () => {
  expect([0, 1, 2, 3, 4, 5].map(progressFraction)).toEqual([
    0, 0.2, 0.4, 0.6, 0.8, 1,
  ]);
  expect(progressFraction(-1)).toBe(0);
  expect(progressFraction(6)).toBe(1);
});
