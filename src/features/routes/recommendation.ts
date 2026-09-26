import {
  estimateRoute,
  type EmissionFactor,
  type RouteEstimate,
} from './emissions.ts';
import type { RouteOption } from './routes.ts';

type Estimated = Extract<RouteEstimate, { kind: 'estimated' }>;
type EstimatedCo2 = Extract<RouteEstimate, { kind: 'estimated_co2' }>;
function estimateKg(estimate: Estimated | EstimatedCo2) {
  return estimate.kind === 'estimated_co2' ? estimate.kg : estimate.kgCo2e;
}
export type Recommendation =
  | {
      kind: 'recommended';
      route: RouteOption;
      estimate: Estimated;
      baseline: Estimated;
      baselineDistanceMeters: number;
      fastestSeconds: number;
      limitSeconds: number;
      avoidedKgCo2e: number;
    }
  | {
      kind: 'recommended_co2';
      gas: 'CO2';
      unit: 'kgCO2';
      route: RouteOption;
      estimate: EstimatedCo2;
      baseline: EstimatedCo2;
      baselineDistanceMeters: number;
      fastestSeconds: number;
      limitSeconds: number;
      avoidedKg: number;
    }
  | {
      kind: 'unavailable';
      reason:
        | 'invalid_tolerance'
        | 'no_routes'
        | 'missing_baseline'
        | 'no_eligible_estimate';
      fastestSeconds?: number;
      limitSeconds?: number;
    };

function validDuration(
  route: RouteOption,
): route is RouteOption & { durationSeconds: number; distanceMeters: number } {
  const legDistanceMeters = route.legs.reduce(
    (sum, leg) => sum + leg.distanceMeters,
    0,
  );
  return (
    route.availability.kind === 'available' &&
    route.durationSeconds !== null &&
    Number.isFinite(route.durationSeconds) &&
    route.durationSeconds > 0 &&
    route.distanceMeters !== null &&
    Number.isFinite(route.distanceMeters) &&
    route.distanceMeters > 0 &&
    route.legs.length > 0 &&
    route.legs.every(
      (leg) =>
        Number.isFinite(leg.distanceMeters) &&
        leg.distanceMeters >= 0 &&
        Number.isFinite(leg.durationSeconds) &&
        leg.durationSeconds >= 0,
    ) &&
    Number.isFinite(legDistanceMeters) &&
    legDistanceMeters > 0
  );
}

export function recommendRoute(
  routes: readonly RouteOption[],
  extraMinutes: number,
  factors: readonly EmissionFactor[],
): Recommendation {
  if (!Number.isSafeInteger(extraMinutes) || extraMinutes < 0)
    return { kind: 'unavailable', reason: 'invalid_tolerance' };
  const available = routes.filter(validDuration);
  if (available.length === 0)
    return { kind: 'unavailable', reason: 'no_routes' };
  const fastestSeconds = Math.min(
    ...available.map((route) => route.durationSeconds),
  );
  const limitSeconds = fastestSeconds + extraMinutes * 60;
  if (!Number.isFinite(limitSeconds))
    return { kind: 'unavailable', reason: 'invalid_tolerance' };

  const driving = available
    .filter((route) => route.mode === 'car')
    .sort(
      (a, b) =>
        a.durationSeconds - b.durationSeconds || a.id.localeCompare(b.id),
    );
  const baselineRoute = driving[0];
  if (!baselineRoute)
    return {
      kind: 'unavailable',
      reason: 'missing_baseline',
      fastestSeconds,
      limitSeconds,
    };
  const baseline = estimateRoute(baselineRoute, factors);
  if (baseline.kind === 'unavailable')
    return {
      kind: 'unavailable',
      reason: 'missing_baseline',
      fastestSeconds,
      limitSeconds,
    };

  const candidates = available.flatMap((route) => {
    if (route.durationSeconds > limitSeconds) return [];
    const estimate = estimateRoute(route, factors);
    return estimate.kind !== 'unavailable' && estimate.kind === baseline.kind
      ? [{ route, estimate }]
      : [];
  });
  candidates.sort(
    (a, b) =>
      estimateKg(a.estimate) - estimateKg(b.estimate) ||
      a.route.durationSeconds - b.route.durationSeconds ||
      a.route.id.localeCompare(b.route.id),
  );
  const winner = candidates[0];
  if (!winner)
    return {
      kind: 'unavailable',
      reason: 'no_eligible_estimate',
      fastestSeconds,
      limitSeconds,
    };
  const baselineDistanceMeters = baselineRoute.legs.reduce(
    (sum, leg) => sum + leg.distanceMeters,
    0,
  );
  const avoidedKgCo2e = estimateKg(baseline) - estimateKg(winner.estimate);
  if (
    !Number.isFinite(baselineDistanceMeters) ||
    !Number.isFinite(avoidedKgCo2e)
  )
    return {
      kind: 'unavailable',
      reason: 'no_eligible_estimate',
      fastestSeconds,
      limitSeconds,
    };
  if (
    baseline.kind === 'estimated_co2' &&
    winner.estimate.kind === 'estimated_co2'
  )
    return {
      kind: 'recommended_co2',
      gas: 'CO2',
      unit: 'kgCO2',
      route: winner.route,
      estimate: winner.estimate,
      baseline,
      baselineDistanceMeters,
      fastestSeconds,
      limitSeconds,
      avoidedKg: avoidedKgCo2e,
    };
  if (baseline.kind !== 'estimated' || winner.estimate.kind !== 'estimated')
    return {
      kind: 'unavailable',
      reason: 'no_eligible_estimate',
      fastestSeconds,
      limitSeconds,
    };
  return {
    kind: 'recommended',
    route: winner.route,
    estimate: winner.estimate,
    baseline,
    baselineDistanceMeters,
    fastestSeconds,
    limitSeconds,
    avoidedKgCo2e,
  };
}
