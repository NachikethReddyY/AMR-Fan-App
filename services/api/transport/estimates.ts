import {
  estimateTransitRoute,
  type TransitLegInput,
} from '@amr/travel-domain/transit-estimates';
import { ACTIVE_CAP_MINUTES } from '@amr/travel-domain/recommendation';
import {
  singaporeFactors,
  type EmissionFactor,
  type RouteEstimate,
} from '@amr/travel-domain/emissions';
import type {
  TransportEstimate,
  TransportLeg,
  TransportRoute,
} from './contracts.ts';
import { distanceBetween } from './geo.ts';

function motorized(leg: TransportLeg): boolean {
  return leg.kind !== 'wait' && leg.kind !== 'transfer';
}

export function estimatePlanRoutes(
  routes: readonly TransportRoute[],
  factors: readonly EmissionFactor[] = singaporeFactors,
): TransportEstimate[] {
  return routes.map((route) => {
    const measured = route.legs.map((leg) =>
      leg.fromCoordinate && leg.toCoordinate
        ? distanceBetween(leg.fromCoordinate, leg.toCoordinate)
        : null,
    );
    const unmeasuredMotorized = route.legs.filter(
      (leg, index) => motorized(leg) && measured[index] === null,
    );
    // Provider route totals are real; sharing the remainder across
    // unmeasurable motorized legs by duration is disclosed approximation,
    // never a substitute for a missing route.
    const canApportion =
      unmeasuredMotorized.length > 0 &&
      route.distanceMeters !== null &&
      Number.isFinite(route.distanceMeters) &&
      route.distanceMeters > 0;
    const measuredSum = measured.reduce<number>(
      (sum, value, index) =>
        sum + (motorized(route.legs[index]) ? (value ?? 0) : 0),
      0,
    );
    const motorizedSeconds = unmeasuredMotorized.reduce(
      (sum, leg) => sum + leg.durationSeconds,
      0,
    );
    const remainder = canApportion
      ? Math.max(0, (route.distanceMeters ?? 0) - measuredSum)
      : null;
    const inputs = route.legs.map((leg, index): TransitLegInput => {
      if (!motorized(leg))
        return { kind: leg.kind, mode: leg.mode, distanceMeters: 0 };
      if (measured[index] !== null)
        return {
          kind: leg.kind,
          mode: leg.mode,
          distanceMeters: measured[index],
        };
      if (remainder === null || motorizedSeconds <= 0)
        return { kind: leg.kind, mode: leg.mode, distanceMeters: null };
      return {
        kind: leg.kind,
        mode: leg.mode,
        distanceMeters: (remainder * leg.durationSeconds) / motorizedSeconds,
      };
    });
    return {
      routeId: route.id,
      estimate: estimateTransitRoute(inputs, factors),
      distanceMethod:
        unmeasuredMotorized.length === 0
          ? ('straight_line' as const)
          : ('apportioned' as const),
    };
  });
}

function estimateKg(estimate: RouteEstimate): number | null {
  if (estimate.kind === 'estimated') return estimate.kgCo2e;
  if (estimate.kind === 'estimated_co2') return estimate.kg;
  return null;
}

/**
 * Lowest estimated emissions among deadline-meeting routes inside the
 * fastest-plus-tolerance window. Falls back to the fastest option when no
 * candidate carries an estimate, and stays unavailable when nothing meets
 * the deadline.
 */
export function recommendTransport(
  routes: readonly TransportRoute[],
  estimates: readonly TransportEstimate[],
  extraMinutes: number,
  arriveBy: string | undefined,
  walkCapMinutes: number = ACTIVE_CAP_MINUTES,
):
  | { kind: 'recommended'; routeId: string; reason: string }
  | { kind: 'unavailable'; reason: string } {
  const eligible = routes.filter((route) => route.meetsDeadline);
  if (eligible.length === 0)
    return {
      kind: 'unavailable',
      reason: arriveBy ? 'deadline_missed' : 'no_route',
    };
  const fastest = eligible.toSorted(
    (a, b) => a.durationSeconds - b.durationSeconds,
  )[0];
  const limit = fastest.durationSeconds + extraMinutes * 60;
  // A 50-minute walk stays listed, but nobody should be told to walk it.
  // Motorized modes have no cap: a long bus ride is a real option.
  const viable = (route: TransportRoute) =>
    route.mode !== 'walk' || route.durationSeconds <= walkCapMinutes * 60;
  const candidates = eligible.flatMap((route) => {
    if (route.durationSeconds > limit || !viable(route)) return [];
    const kg = estimateKg(
      estimates.find((item) => item.routeId === route.id)?.estimate ?? {
        kind: 'unavailable',
        reason: 'invalid_route',
      },
    );
    return kg === null ? [] : [{ route, kg }];
  });
  candidates.sort(
    (a, b) =>
      a.kg - b.kg ||
      a.route.durationSeconds - b.route.durationSeconds ||
      (a.route.id < b.route.id ? -1 : a.route.id > b.route.id ? 1 : 0),
  );
  const winner = candidates[0];
  if (!winner)
    return {
      kind: 'recommended',
      routeId: fastest.id,
      reason: 'Earliest arrival within the requested conditions.',
    };
  if (winner.route.id === fastest.id)
    return {
      kind: 'recommended',
      routeId: winner.route.id,
      reason:
        'Lowest estimated emissions and the fastest option within the requested conditions.',
    };
  const slowerBy = Math.round(
    (winner.route.durationSeconds - fastest.durationSeconds) / 60,
  );
  return {
    kind: 'recommended',
    routeId: winner.route.id,
    reason: `Lowest estimated emissions within ${extraMinutes} min of the fastest option; about ${slowerBy} min slower.`,
  };
}
