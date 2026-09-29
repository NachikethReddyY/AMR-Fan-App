import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRoutePreference } from './route-preference.ts';

const snapshot = {
  snapshotId: 'fixture-1',
  extraMinutes: 10,
  routes: [
    { id: 'fast', durationSeconds: 600, kgCo2e: 3, points: 0 },
    { id: 'bus', durationSeconds: 1200, kgCo2e: 1, points: 50 },
    { id: 'slow', durationSeconds: 1201, kgCo2e: 0, points: 100 },
  ],
};
const preference = {
  snapshotId: 'fixture-1',
  orderedRouteIds: ['bus', 'fast'],
  confidence: 0.7,
};

test('relative preference only reorders original metrics inside the exact hard time limit', () => {
  const original = structuredClone(snapshot);
  const result = validateRoutePreference(snapshot, preference);
  assert.equal(result.kind, 'preference');
  if (result.kind !== 'preference') return;
  assert.equal(result.limitSeconds, 1200);
  assert.deepEqual(result.routes, [snapshot.routes[1], snapshot.routes[0]]);
  assert.deepEqual(snapshot, original);
  assert.equal('award' in result, false);
});

for (const [label, value] of [
  ['over limit', { ...preference, orderedRouteIds: ['slow', 'fast'] }],
  ['invented route', { ...preference, orderedRouteIds: ['invented', 'fast'] }],
  ['duplicate route', { ...preference, orderedRouteIds: ['bus', 'bus'] }],
  ['missing route', { ...preference, orderedRouteIds: ['bus'] }],
  ['stale snapshot', { ...preference, snapshotId: 'old' }],
  ['invented quantities', { ...preference, points: 5000 }],
  ['tool', { ...preference, tool_calls: [] }],
  ['invalid confidence', { ...preference, confidence: NaN }],
  [
    'oversized output',
    { ...preference, orderedRouteIds: Array(13).fill('bus') },
  ],
] as const) {
  test(`route ${label} retains deterministic fallback`, () => {
    assert.deepEqual(validateRoutePreference(snapshot, value), {
      kind: 'unavailable',
      reason: 'invalid-output',
      fallback: 'deterministic',
    });
  });
}

test('missing metrics never exclude the fastest route to enlarge the time limit', () => {
  assert.deepEqual(
    validateRoutePreference(
      {
        ...snapshot,
        routes: [
          { ...snapshot.routes[0], kgCo2e: null },
          ...snapshot.routes.slice(1),
        ],
      },
      preference,
    ),
    {
      kind: 'unavailable',
      reason: 'missing-metrics',
      fallback: 'deterministic',
    },
  );
});

test('malformed, duplicate, oversized and location-bearing snapshots cause no fabricated recommendation', () => {
  for (const bad of [
    null,
    { ...snapshot, extraMinutes: -1 },
    { ...snapshot, routes: [...snapshot.routes, snapshot.routes[0]] },
    { ...snapshot, routes: Array(13).fill(snapshot.routes[0]) },
    { ...snapshot, latitude: 1 },
    {
      ...snapshot,
      routes: [{ ...snapshot.routes[0], durationSeconds: Infinity }],
    },
  ])
    assert.equal(validateRoutePreference(bad, preference).kind, 'unavailable');
});

test('confidence is optional metadata, not a sorting or correctness score', () => {
  for (const confidence of [0, 1, null]) {
    const result = validateRoutePreference(snapshot, {
      ...preference,
      confidence,
    });
    assert.equal(result.kind, 'preference');
    if (result.kind === 'preference') assert.equal(result.routes[0]?.id, 'bus');
  }
});
