import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  candidatePolicy,
  parse,
  policySchema,
  routeSchema,
  type LocationSample,
} from './contracts.ts';
import { routeFixture } from './fixtures.ts';
import { assessJourney } from './evidence.ts';

const startedAtMs = 1_000_000;
const finishedAtMs = startedAtMs + 300_000;
const route = parse(routeSchema, routeFixture(startedAtMs));
function sample(latitude: number, seconds: number): LocationSample {
  return {
    id: randomUUID(),
    acquiredAtMs: startedAtMs + seconds * 1000,
    receivedAtMs: startedAtMs + seconds * 1000,
    latitude,
    longitude: 103.8,
    accuracyMeters: 5,
    context: 'unknown',
    mocked: null,
  };
}
const samples = [
  sample(1.3, 0),
  sample(1.303, 90),
  sample(1.306, 180),
  sample(1.31, 300),
];
const input = {
  route,
  policy: candidatePolicy,
  startedAtMs,
  finishedAtMs,
  finishReason: 'arrival',
  revision: 1,
};
test('ordered endpoint and corridor evidence can support only a calibrated prototype candidate, never verified travel', () => {
  const result = assessJourney({ ...input, samples });
  assert.equal(result.status, 'satisfies_configured_rules');
  assert.equal(result.calibration, 'unvalidated');
  assert.equal(result.startRecorded, true);
  assert.equal(result.arrivalRecorded, true);
  assert.equal(result.elapsedMs, 300000);
  assert.ok(
    result.observedDistanceMeters > 1000 &&
      result.observedDistanceMeters < 1120,
  );
  assert.deepEqual(
    assessJourney({ ...input, samples: [...samples].reverse() }),
    result,
  );
});

test('candidate thresholds preserve gaps, unknown accuracy, endpoint freshness and teleport uncertainty', () => {
  const unknown = samples.map((s) => ({ ...s, accuracyMeters: null }));
  assert.equal(
    assessJourney({ ...input, samples: unknown }).status,
    'insufficient_evidence',
  );
  const gap = assessJourney({ ...input, samples: [samples[0], samples[3]] });
  assert.equal(gap.startRecorded, true);
  assert.equal(gap.arrivalRecorded, true);
  assert.ok(gap.reasons.includes('continuity_gap'));
  const atAccuracy = assessJourney({
    ...input,
    samples: samples.map((s) => ({ ...s, accuracyMeters: 50 })),
  });
  assert.equal(atAccuracy.startRecorded, true);
  const pastAccuracy = assessJourney({
    ...input,
    samples: samples.map((s) => ({ ...s, accuracyMeters: 50.001 })),
  });
  assert.equal(pastAccuracy.startRecorded, false);
  assert.equal(
    assessJourney({
      ...input,
      samples: [
        { ...samples[0], acquiredAtMs: startedAtMs + 30000 },
        ...samples.slice(1),
      ],
    }).startRecorded,
    true,
  );
  assert.equal(
    assessJourney({
      ...input,
      samples: [
        { ...samples[0], acquiredAtMs: startedAtMs + 30001 },
        ...samples.slice(1),
      ],
    }).startRecorded,
    false,
  );
  const teleport = assessJourney({
    ...input,
    finishedAtMs: startedAtMs + 1000,
    samples: [samples[0], { ...samples[3], acquiredAtMs: startedAtMs }],
  });
  assert.notEqual(teleport.status, 'satisfies_configured_rules');
  assert.ok(teleport.reasons.includes('conflicting_timestamps'));
  const rapid = assessJourney({
    ...input,
    finishedAtMs: startedAtMs + 1000,
    samples: [samples[0], { ...samples[3], acquiredAtMs: startedAtMs + 1000 }],
  });
  assert.ok((rapid.maxObservedSpeedMps ?? 0) > 1000);
  assert.equal(rapid.modePlausibility, 'unassessed');
  assert.equal(rapid.calibration, 'unvalidated');
  const offRoute = assessJourney({
    ...input,
    samples: [
      samples[0],
      { ...samples[1], longitude: 103.81 },
      ...samples.slice(2),
    ],
  });
  assert.equal(offRoute.status, 'ineligible');
  const mocked = assessJourney({
    ...input,
    samples: samples.map((s) => ({ ...s, mocked: true })),
  });
  assert.equal(mocked.status, 'ineligible');
  assert.equal(
    assessJourney({ ...input, finishReason: 'stopped', samples }).status,
    'insufficient_evidence',
  );
});

test('uncertainty circles and continuity thresholds are inclusive only at the retained boundary', () => {
  const meterLatitude = 180 / (Math.PI * 6371008.8);
  const boundaryStart = {
    ...samples[0],
    latitude: 1.3 + 49.999 * meterLatitude,
    accuracyMeters: 50,
  };
  const outsideStart = {
    ...boundaryStart,
    latitude: 1.3 + 50.001 * meterLatitude,
  };
  assert.equal(
    assessJourney({ ...input, samples: [boundaryStart, ...samples.slice(1)] })
      .startRecorded,
    true,
  );
  assert.equal(
    assessJourney({ ...input, samples: [outsideStart, ...samples.slice(1)] })
      .startRecorded,
    false,
  );
  assert.ok(
    !assessJourney({ ...input, samples }).reasons.includes('continuity_gap'),
  );
  assert.ok(
    assessJourney({
      ...input,
      samples: [
        samples[0],
        { ...samples[1], acquiredAtMs: startedAtMs + 120001 },
        ...samples.slice(2),
      ],
    }).reasons.includes('continuity_gap'),
  );
  const longitudeMeter =
    meterLatitude / Math.cos((samples[1].latitude * Math.PI) / 180);
  const corridorInside = {
    ...samples[1],
    longitude: 103.8 + 49.999 * longitudeMeter,
    accuracyMeters: 50,
  };
  const corridorUncertain = {
    ...corridorInside,
    longitude: 103.8 + 50.001 * longitudeMeter,
  };
  assert.ok(
    !assessJourney({
      ...input,
      samples: [samples[0], corridorInside, ...samples.slice(2)],
    }).reasons.includes('uncertain_corridor'),
  );
  assert.ok(
    assessJourney({
      ...input,
      samples: [samples[0], corridorUncertain, ...samples.slice(2)],
    }).reasons.includes('uncertain_corridor'),
  );
});

test('obvious reverse progression cannot satisfy configured route adherence', () => {
  const reversed = [
    sample(1.3, 0),
    sample(1.308, 90),
    sample(1.303, 180),
    sample(1.31, 300),
  ];
  const assessed = assessJourney({ ...input, samples: reversed });
  assert.equal(assessed.status, 'ineligible');
  assert.ok(assessed.reasons.includes('reverse_progression'));
});

test('an explicit retained mode-speed candidate detects teleport without borrowing routing ETA as an eligibility limit', () => {
  const policy = parse(policySchema, {
    ...candidatePolicy,
    version: 'synthetic-speed-test-v1',
    maxSpeedMpsByMode: { bus: 60 },
  });
  const rapid = assessJourney({
    ...input,
    policy,
    finishedAtMs: startedAtMs + 1000,
    samples: [samples[0], { ...samples[3], acquiredAtMs: startedAtMs + 1000 }],
  });
  assert.equal(rapid.status, 'ineligible');
  assert.equal(rapid.modePlausibility, 'inconsistent_with_configured_speed');
  assert.ok(rapid.reasons.includes('speed_exceeds_configured_bound'));
  const plausible = assessJourney({ ...input, policy, samples });
  assert.equal(plausible.status, 'satisfies_configured_rules');
  assert.equal(plausible.modePlausibility, 'consistent_with_configured_speed');
  assert.equal(plausible.calibration, 'unvalidated');
});

const loopPoints = [
  { latitude: 1.29, longitude: 103.85 },
  { latitude: 1.295, longitude: 103.85 },
  { latitude: 1.295, longitude: 103.855 },
  { latitude: 1.29, longitude: 103.855 },
  { latitude: 1.29, longitude: 103.85 },
];
function geometryAssessment(points: typeof loopPoints, visited = points) {
  return assessJourney({
    ...input,
    route: {
      ...route,
      mode: 'walk',
      start: points[0],
      end: points[points.length - 1],
      points,
    },
    finishedAtMs: startedAtMs + (visited.length - 1) * 60000,
    samples: visited.map((point, index) => ({
      ...sample(point.latitude, index * 60),
      ...point,
      accuracyMeters: 2,
      mocked: false,
    })),
  });
}

test('R34-1: forward closed WALK loop resolves the final origin to its later route occurrence', () => {
  const assessed = geometryAssessment(loopPoints);
  assert.equal(assessed.status, 'satisfies_configured_rules');
  assert.deepEqual(assessed.reasons, []);
  assert.equal(assessed.startRecorded, true);
  assert.equal(assessed.arrivalRecorded, true);
  assert.equal(assessed.calibration, 'unvalidated');
});

test('R34-1: duplicate vertices retain useful loop geometry and spatially near closure selects the later occurrence', () => {
  const duplicates = loopPoints.flatMap((point) => [point, point]);
  assert.equal(
    geometryAssessment(duplicates, loopPoints).status,
    'satisfies_configured_rules',
  );
  const nearClosure = [
    ...loopPoints.slice(0, -1),
    { latitude: 1.290005, longitude: 103.85 },
  ];
  assert.equal(
    geometryAssessment(loopPoints, nearClosure).status,
    'satisfies_configured_rules',
  );
});

test('R34-1: backwards loops, reversal before closure and definite off-route samples remain ineligible', () => {
  const reversedLoop = geometryAssessment(
    loopPoints,
    [...loopPoints].reverse(),
  );
  assert.equal(reversedLoop.status, 'ineligible');
  assert.ok(reversedLoop.reasons.includes('reverse_progression'));
  const reversedEdge = geometryAssessment(loopPoints, [
    loopPoints[0],
    loopPoints[1],
    { latitude: 1.292, longitude: 103.85 },
    ...loopPoints.slice(2),
  ]);
  assert.equal(reversedEdge.status, 'ineligible');
  assert.ok(reversedEdge.reasons.includes('reverse_progression'));
  const offRoute = geometryAssessment(loopPoints, [
    loopPoints[0],
    { latitude: 1.31, longitude: 103.87 },
    ...loopPoints.slice(1),
  ]);
  assert.equal(offRoute.status, 'ineligible');
  assert.ok(offRoute.reasons.includes('off_route'));
});

test('R34-1: shared forward segments retain traversal position and cannot conceal a reversal on the later pass', () => {
  const a = loopPoints[0],
    b = loopPoints[1],
    c = loopPoints[2],
    d = loopPoints[3];
  const end = { latitude: 1.3, longitude: 103.85 };
  const shared = [a, b, c, d, a, b, end];
  const forward = geometryAssessment(shared);
  assert.equal(forward.status, 'satisfies_configured_rules');
  const backward = geometryAssessment(shared, [
    a,
    b,
    c,
    d,
    a,
    b,
    { latitude: 1.292, longitude: 103.85 },
    b,
    end,
  ]);
  assert.equal(backward.status, 'ineligible');
  assert.ok(backward.reasons.includes('reverse_progression'));
});

test('R34-1: a figure-eight crossing is ordered by its earlier traversal, not the greatest available progress', () => {
  const center = { latitude: 1.2925, longitude: 103.8525 };
  const crossing = [
    center,
    loopPoints[0],
    loopPoints[1],
    center,
    loopPoints[3],
    loopPoints[2],
    center,
  ];
  assert.equal(
    geometryAssessment(crossing).status,
    'satisfies_configured_rules',
  );
  const reverse = geometryAssessment(crossing, [
    center,
    loopPoints[0],
    loopPoints[1],
    center,
    loopPoints[2],
    loopPoints[3],
    center,
  ]);
  assert.equal(reverse.status, 'ineligible');
  assert.ok(reverse.reasons.includes('reverse_progression'));
});

test('R34-1: indistinguishable forward/backward shared-segment occurrences report insufficient progression', () => {
  const a = loopPoints[0],
    b = loopPoints[1];
  const middle = { latitude: 1.2925, longitude: 103.85 };
  const outAndBack = geometryAssessment([a, b, a], [a, middle, b, middle, a]);
  assert.equal(outAndBack.status, 'insufficient_evidence');
  assert.ok(outAndBack.reasons.includes('ambiguous_progression'));
  assert.ok(!outAndBack.reasons.includes('reverse_progression'));
});

test('R34-1: unresolved shared travel does not disable subsequent unambiguous reversal checks', () => {
  const a = loopPoints[0],
    b = loopPoints[1];
  const c = { latitude: 1.29, longitude: 103.86 };
  const end = { latitude: 1.295, longitude: 103.86 };
  const backward = { latitude: 1.29, longitude: 103.857 };
  const assessed = geometryAssessment(
    [a, b, a, c, end],
    [a, b, a, c, backward, c, end],
  );
  assert.equal(assessed.status, 'ineligible');
  assert.ok(assessed.reasons.includes('ambiguous_progression'));
  assert.ok(assessed.reasons.includes('reverse_progression'));
});
