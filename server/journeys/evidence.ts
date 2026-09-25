import type {
  Assessment,
  EvidencePolicy,
  LocationSample,
  RouteSnapshot,
} from './contracts.ts';

type Point = { latitude: number; longitude: number };
const radians = Math.PI / 180;
const earthMeters = 6_371_008.8;
export function distanceMeters(a: Point, b: Point) {
  const dLat = (b.latitude - a.latitude) * radians;
  const dLng = (b.longitude - a.longitude) * radians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(dLng / 2) ** 2;
  return earthMeters * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

// Local tangent-plane projection is used only for the Singapore route corridor.
function routeDistance(point: Point, points: readonly Point[]) {
  let nearest = Infinity;
  let progress = 0;
  let traversed = 0;
  const scale = Math.cos(point.latitude * radians);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const ax = (a.longitude - point.longitude) * radians * earthMeters * scale;
    const ay = (a.latitude - point.latitude) * radians * earthMeters;
    const bx = (b.longitude - point.longitude) * radians * earthMeters * scale;
    const by = (b.latitude - point.latitude) * radians * earthMeters;
    const dx = bx - ax,
      dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const fraction =
      lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const offset = Math.hypot(ax + fraction * dx, ay + fraction * dy);
    const length = Math.sqrt(lengthSquared);
    if (offset < nearest) {
      nearest = offset;
      progress = traversed + fraction * length;
    }
    traversed += length;
  }
  return { offset: nearest, progress };
}

export function assessJourney({
  route,
  policy,
  startedAtMs,
  finishedAtMs,
  finishReason,
  revision,
  samples,
}: {
  route: RouteSnapshot;
  policy: EvidencePolicy;
  startedAtMs: number;
  finishedAtMs: number | null;
  finishReason: string | null;
  revision: number;
  samples: LocationSample[];
}): Assessment {
  const reasons = new Set<string>();
  let contradiction = false;
  const ordered = [...samples].sort(
    (a, b) => a.acquiredAtMs - b.acquiredAtMs || a.id.localeCompare(b.id),
  );
  const usable: LocationSample[] = [];
  let lastProgress: { meters: number; accuracy: number } | null = null;
  for (const sample of ordered) {
    if (sample.mocked === true) {
      contradiction = true;
      reasons.add('mock_location');
      continue;
    }
    if (
      sample.acquiredAtMs < startedAtMs ||
      (finishedAtMs !== null && sample.acquiredAtMs > finishedAtMs)
    ) {
      reasons.add('outside_capture_interval');
      continue;
    }
    if (
      sample.accuracyMeters === null ||
      sample.accuracyMeters > policy.accuracyMeters
    ) {
      reasons.add('uncertain_accuracy');
      continue;
    }
    const projected = routeDistance(sample, route.points);
    const offRoute = projected.offset;
    if (offRoute - sample.accuracyMeters > policy.corridorMeters) {
      contradiction = true;
      reasons.add('off_route');
    } else if (offRoute + sample.accuracyMeters > policy.corridorMeters) {
      reasons.add('uncertain_corridor');
    }
    if (
      lastProgress &&
      projected.progress + sample.accuracyMeters <
        lastProgress.meters - lastProgress.accuracy
    ) {
      contradiction = true;
      reasons.add('reverse_progression');
    }
    lastProgress = {
      meters: projected.progress,
      accuracy: sample.accuracyMeters,
    };
    usable.push(sample);
  }
  const contains = (sample: LocationSample, point: Point) =>
    sample.accuracyMeters !== null &&
    distanceMeters(sample, point) + sample.accuracyMeters <=
      policy.endpointMeters;
  const start = usable.find(
    (s) =>
      s.acquiredAtMs - startedAtMs <= policy.endpointFreshnessMs &&
      contains(s, route.start),
  );
  const arrival =
    finishedAtMs === null
      ? undefined
      : usable.findLast(
          (s) =>
            finishedAtMs - s.acquiredAtMs <= policy.endpointFreshnessMs &&
            contains(s, route.end),
        );
  if (!start) reasons.add('missing_start');
  if (!arrival) reasons.add('missing_arrival');
  let observedDistanceMeters = 0;
  let maxObservedSpeedMps: number | null = null;
  for (let i = 1; i < usable.length; i++) {
    const a = usable[i - 1],
      b = usable[i];
    const elapsed = b.acquiredAtMs - a.acquiredAtMs;
    // Subtract uncertainty so stationary jitter does not become traveled distance.
    const movement = Math.max(
      0,
      distanceMeters(a, b) - (a.accuracyMeters ?? 0) - (b.accuracyMeters ?? 0),
    );
    if (elapsed > policy.continuityGapMs) {
      reasons.add('continuity_gap');
      continue;
    }
    if (elapsed === 0 && movement > 0) {
      contradiction = true;
      reasons.add('conflicting_timestamps');
      continue;
    }
    if (elapsed > 0)
      maxObservedSpeedMps = Math.max(
        maxObservedSpeedMps ?? 0,
        movement / (elapsed / 1000),
      );
    observedDistanceMeters += movement;
  }
  if (
    finishedAtMs !== null &&
    (finishedAtMs <= startedAtMs ||
      !start ||
      !arrival ||
      arrival.acquiredAtMs <= start.acquiredAtMs ||
      observedDistanceMeters <= 0)
  )
    reasons.add('insufficient_movement');
  if (finishedAtMs !== null && finishReason !== 'arrival')
    reasons.add('not_arrived');
  const speedLimit = policy.maxSpeedMpsByMode[route.mode];
  const excessiveSpeed =
    speedLimit !== undefined &&
    maxObservedSpeedMps !== null &&
    maxObservedSpeedMps > speedLimit;
  if (excessiveSpeed) {
    contradiction = true;
    reasons.add('speed_exceeds_configured_bound');
  }
  const status =
    finishedAtMs === null
      ? 'unfinished'
      : contradiction
        ? 'ineligible'
        : reasons.size > 0
          ? 'insufficient_evidence'
          : 'satisfies_configured_rules';
  return {
    version: policy.version,
    calibration: 'unvalidated',
    revision,
    status,
    reasons: [...reasons].sort(),
    startRecorded: !!start,
    arrivalRecorded: !!arrival,
    sampleCount: samples.length,
    elapsedMs:
      finishedAtMs === null ? null : Math.max(0, finishedAtMs - startedAtMs),
    observedDistanceMeters,
    maxObservedSpeedMps,
    modePlausibility: excessiveSpeed
      ? 'inconsistent_with_configured_speed'
      : speedLimit !== undefined && maxObservedSpeedMps !== null
        ? 'consistent_with_configured_speed'
        : 'unassessed',
  };
}
