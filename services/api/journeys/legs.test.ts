import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessLegs } from './legs.ts';
import {
  candidatePolicy,
  type RouteSnapshot,
  type LocationSample,
} from './contracts.ts';
import { assessJourney } from './evidence.ts';
const a = { latitude: 1.3, longitude: 103.8 },
  b = { latitude: 1.3, longitude: 103.804 },
  c = { latitude: 1.3, longitude: 103.808 };
const route: RouteSnapshot = {
  routeId: 'fixture',
  routeEvidence: {
    primaryMode: 'TRANSIT',
    factorApplicability: 'singapore_indicative',
    geographyVersion: 'test',
  },
  source: { kind: 'fixture', label: 'test' },
  fetchedAt: '2026-01-01T00:00:00.000Z',
  query: { origin: a, destination: c, modes: ['TRANSIT'], extraMinutes: 0 },
  mode: 'bus',
  start: a,
  end: c,
  points: [a, b, c],
  distanceMeters: 999,
  durationSeconds: 60,
  legs: [
    { mode: 'walk', distanceMeters: 499, durationSeconds: 30 },
    { mode: 'bus', distanceMeters: 500, durationSeconds: 30 },
  ],
  legGeometry: {
    kind: 'provider',
    legs: [
      { legIndex: 0, points: [a, b] },
      { legIndex: 1, points: [b, c] },
    ],
  },
  basis: {
    factorVersions: [],
    factorStatus: 'unavailable',
    earningRuleVersion: 'test',
    calculation: { kind: 'unavailable', reason: 'test' },
  },
};
const samples: LocationSample[] = [a, b, c].map((p, i) => ({
  ...p,
  id: `00000000-0000-4000-8000-00000000000${i}`,
  acquiredAtMs: 1000 + i * 20000,
  receivedAtMs: 1000 + i * 20000,
  accuracyMeters: 0,
  context: 'foreground',
  mocked: false,
}));
function run(r = route, s = samples) {
  const assessment = assessJourney({
    route: r,
    policy: candidatePolicy,
    startedAtMs: 1000,
    finishedAtMs: 41000,
    finishReason: 'arrival',
    revision: 1,
    samples: s,
  });
  return assessLegs({
    route: r,
    policy: candidatePolicy,
    assessment,
    samples: s,
  });
}
test('complete ordered observed legs use GPS lower bounds, never provider distances or durations', () => {
  const result = run();
  assert.equal(result.kind, 'available');
  if (result.kind !== 'available') return;
  assert.equal(result.method, 'gps_leg_geometry_lower_bound');
  assert.deepEqual(
    result.legs.map((l) => l.mode),
    ['walk', 'bus'],
  );
  assert.ok(
    result.legs.every((l) => l.distanceMeters > 440 && l.distanceMeters < 450),
  );
  assert.deepEqual(
    result.legs.map((l) => l.durationSeconds),
    [20, 20],
  );
});
test('matching only one leg or skipping its transition cannot make a full multimodal path', () => {
  assert.equal(run(route, [samples[0], samples[2]]).kind, 'unavailable');
  assert.equal(run(route, samples.slice(0, 2)).kind, 'unavailable');
});
test('missing, disconnected, overlapping and reordered leg geometry are unavailable', () => {
  for (const legGeometry of [
    undefined,
    { kind: 'unavailable' as const, reason: 'missing_geometry' as const },
    { kind: 'provider' as const, legs: [{ legIndex: 0, points: [a, b] }] },
    {
      kind: 'provider' as const,
      legs: [
        { legIndex: 0, points: [a, c] },
        { legIndex: 1, points: [a, c] },
      ],
    },
    {
      kind: 'provider' as const,
      legs: [
        { legIndex: 1, points: [a, b] },
        { legIndex: 0, points: [b, c] },
      ],
    },
  ]) {
    assert.equal(run({ ...route, legGeometry }).kind, 'unavailable');
  }
});
test('uncertain transition and gaps never allocate planned distance to a mode', () => {
  assert.equal(
    run(
      route,
      samples.map((s, i) => (i === 1 ? { ...s, latitude: 1.302 } : s)),
    ).kind,
    'unavailable',
  );
  assert.equal(
    run(
      route,
      samples.map((s, i) => (i === 1 ? { ...s, accuracyMeters: null } : s)),
    ).kind,
    'unavailable',
  );
});
test('leg geometry has an aggregate point bound, even when each leg is individually valid', async () => {
  const { legGeometrySchema } = await import('./contracts.ts');
  assert.equal(
    legGeometrySchema.safeParse({
      kind: 'provider',
      legs: [
        {
          legIndex: 0,
          points: Array.from({ length: 1025 }, (_, i) => (i % 2 ? a : b)),
        },
        {
          legIndex: 1,
          points: Array.from({ length: 1024 }, (_, i) => (i % 2 ? b : c)),
        },
      ],
    }).success,
    false,
  );
});
