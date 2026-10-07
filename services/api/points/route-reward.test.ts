import test from 'node:test';
import assert from 'node:assert/strict';
import { routeRewardPoints } from './route-reward.ts';

test('route reward converts saved kilograms to whole points with the journey cap', () => {
  assert.equal(routeRewardPoints(0.22), 11);
  assert.equal(routeRewardPoints(100), 2000);
  assert.equal(routeRewardPoints(-1), 0);
});
