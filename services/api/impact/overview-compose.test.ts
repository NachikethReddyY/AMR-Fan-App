import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeImpactOverview } from './overview.ts';

const travel = {
  period: 'lifetime' as const,
  unit: 'kgCO2' as const,
  personal: { kind: 'empty' as const },
  community: { kind: 'empty' as const },
  sources: [],
  validation: [],
};

test('demo participation is unavailable while community remains available', () => {
  const result = composeImpactOverview({
    official: { status: 'empty', metrics: [] },
    participation: {
      profileKind: 'demo',
      personal: null,
      community: { activityCount: 2, missionsCompleted: 1 },
    },
    travel,
  });
  assert.deepEqual(result.fan.personal.participation, {
    kind: 'unavailable',
    reason: 'demo_profile',
  });
  assert.deepEqual(result.fan.community.participation, {
    kind: 'available',
    activityCount: 2,
    missionsCompleted: 1,
  });
});

test('independent source failures stay unavailable and never become zero', () => {
  const result = composeImpactOverview({
    official: {
      status: 'unavailable',
      metrics: [],
      reason: 'source_unavailable',
    },
    participation: null,
    travel: null,
  });
  assert.equal(result.official.status, 'unavailable');
  assert.deepEqual(result.fan.personal.participation, {
    kind: 'unavailable',
    reason: 'source_unavailable',
  });
  assert.deepEqual(result.travelMethodology, {
    kind: 'unavailable',
    reason: 'source_unavailable',
  });
  assert.equal(
    result.methodology.find((x) => x.label === 'Points participation')?.unit,
    'points',
  );
});

test('points methodology is explicit and does not claim carbon conversion', () => {
  const result = composeImpactOverview({
    official: { status: 'empty', metrics: [] },
    participation: {
      profileKind: 'real',
      personal: { activityCount: 1, missionsCompleted: 0, pointsEarned: 50 },
      community: { activityCount: 1, missionsCompleted: 0 },
    },
    travel,
  });
  assert.match(
    result.methodology.find((x) => x.label === 'Points participation')
      ?.assumptions ?? '',
    /not CO2/,
  );
  assert.equal(result.fan.personal.participation.kind, 'available');
});
