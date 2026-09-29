import { assessJourney, distanceMeters } from './evidence.ts';
import { sameEndpoint } from '../routes/normalize.ts';
import type {
  Assessment,
  EvidencePolicy,
  LocationSample,
  RouteSnapshot,
  assessedLegsSchema,
} from './contracts.ts';
import type { z } from 'zod';
type Point = { latitude: number; longitude: number };
function offset(point: Point, points: Point[]) {
  let nearest = Infinity;
  const scale = Math.cos((point.latitude * Math.PI) / 180);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const ax = (a.longitude - point.longitude) * scale,
      ay = a.latitude - point.latitude;
    const dx = (b.longitude - a.longitude) * scale,
      dy = b.latitude - a.latitude;
    const t =
      dx * dx + dy * dy === 0
        ? 0
        : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
    nearest = Math.min(
      nearest,
      distanceMeters(point, {
        latitude: a.latitude + t * (b.latitude - a.latitude),
        longitude: a.longitude + t * (b.longitude - a.longitude),
      }),
    );
  }
  return nearest;
}
export function assessLegs({
  route,
  policy,
  assessment,
  samples,
}: {
  route: RouteSnapshot;
  policy: EvidencePolicy;
  assessment: Assessment;
  samples: LocationSample[];
}): z.infer<typeof assessedLegsSchema> {
  if (assessment.status !== 'satisfies_configured_rules')
    return { kind: 'unavailable', reason: 'insufficient_evidence' };
  if (new Set(route.legs.map((l) => l.mode)).size === 1)
    return {
      kind: 'available',
      method: 'gps_single_mode_lower_bound',
      legs: [
        {
          mode: route.legs[0].mode,
          distanceMeters: assessment.observedDistanceMeters,
          durationSeconds: (assessment.elapsedMs ?? 0) / 1000,
        },
      ],
    };
  const unavailable = {
    kind: 'unavailable',
    reason: 'multimodal_distances_unknown',
  } as const;
  const geometry = route.legGeometry;
  if (
    geometry?.kind !== 'provider' ||
    geometry.legs.length !== route.legs.length
  )
    return unavailable;
  for (const [i, leg] of geometry.legs.entries()) {
    if (
      leg.legIndex !== i ||
      !sameEndpoint(
        leg.points[0],
        i === 0
          ? route.start
          : (geometry.legs[i - 1].points.at(-1) ?? route.start),
      )
    )
      return unavailable;
  }
  const last = geometry.legs.at(-1)?.points.at(-1);
  if (!last || !sameEndpoint(last, route.end)) return unavailable;
  const ordered = [...samples].sort(
    (a, b) => a.acquiredAtMs - b.acquiredAtMs || a.id.localeCompare(b.id),
  );
  const assigned: LocationSample[][] = geometry.legs.map(() => []);
  let previousIndex = 0;
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1],
      b = ordered[i];
    if (a.accuracyMeters === null || b.accuracyMeters === null)
      return unavailable;
    const aAccuracy = a.accuracyMeters,
      bAccuracy = b.accuracyMeters;
    const candidates = geometry.legs.filter(
      (leg) =>
        offset(a, leg.points) + aAccuracy <= policy.corridorMeters &&
        offset(b, leg.points) + bAccuracy <= policy.corridorMeters,
    );
    // Every observed interval must map uniquely, in order. No skipped transition
    // or partial set of matched pairs can become a complete earning distance.
    if (candidates.length !== 1) return unavailable;
    const index = candidates[0].legIndex;
    if (index < previousIndex || index > previousIndex + 1) return unavailable;
    const list = assigned[index];
    if (!list.length) list.push(a);
    list.push(b);
    previousIndex = index;
  }
  const legs: RouteSnapshot['legs'] = [];
  for (const [index, points] of assigned.entries()) {
    if (points.length < 2) return unavailable;
    const shape = geometry.legs[index].points;
    const end = shape.at(-1),
      finish = points.at(-1);
    if (!end || !finish) return unavailable;
    const assessed = assessJourney({
      route: {
        ...route,
        mode: route.legs[index].mode,
        start: shape[0],
        end,
        points: shape,
      },
      policy,
      startedAtMs: points[0].acquiredAtMs,
      finishedAtMs: finish.acquiredAtMs,
      finishReason: 'arrival',
      revision: assessment.revision,
      samples: points,
    });
    if (
      assessed.status !== 'satisfies_configured_rules' ||
      assessed.observedDistanceMeters <= 0
    )
      return unavailable;
    legs.push({
      mode: route.legs[index].mode,
      distanceMeters: assessed.observedDistanceMeters,
      durationSeconds: (assessed.elapsedMs ?? 0) / 1000,
    });
  }
  return { kind: 'available', method: 'gps_leg_geometry_lower_bound', legs };
}
