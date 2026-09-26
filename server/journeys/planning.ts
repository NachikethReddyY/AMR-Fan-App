import { z } from 'zod';
import { routeInput } from '../routes/provider.ts';
import type { RouteQueryResult } from '../routes/query.ts';
import {
  id,
  routeSchema,
  sourceSchema,
  summarySchema,
  type RouteSnapshot,
} from './contracts.ts';

// Durable comparison deliberately excludes addresses, geometry and leg descriptions.
const text = z.string().min(1).max(160);
const mode = routeSchema.shape.mode;
const seconds = z.number().nonnegative().max(604800);
const meters = z.number().nonnegative().max(20_000_128);
const estimated = z.strictObject({
  kind: z.literal('estimated'),
  kgCo2e: z.number().nonnegative(),
  factorIds: z.array(text).max(128),
});
const estimate = z.discriminatedUnion('kind', [
  estimated,
  z.strictObject({
    kind: z.literal('unavailable'),
    reason: text,
    mode: mode.optional(),
  }),
]);
export const planDisplaySchema = z.strictObject({
  version: z.literal(1),
  source: sourceSchema.nullable(),
  fetchedAt: z.iso.datetime().nullable(),
  modes: routeInput.shape.modes,
  extraMinutes: routeInput.shape.extraMinutes,
  routes: z
    .array(
      z.strictObject({
        routeId: text,
        mode,
        availability: z.discriminatedUnion('kind', [
          z.strictObject({ kind: z.literal('available') }),
          z.strictObject({
            kind: z.literal('unavailable'),
            reason: z.string().min(1).max(2000),
          }),
        ]),
        distanceMeters: meters.nullable(),
        durationSeconds: seconds.nullable(),
        legs: z
          .array(
            z.strictObject({
              mode,
              distanceMeters: meters,
              durationSeconds: seconds,
            }),
          )
          .max(128),
        estimate,
      }),
    )
    .max(12),
  recommendation: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('recommended'),
      routeId: text,
      estimate: estimated,
      baseline: estimated,
      baselineDistanceMeters: meters,
      fastestSeconds: seconds,
      limitSeconds: z.number().nonnegative().max(691200),
      avoidedKgCo2e: z.number(),
    }),
    z.strictObject({
      kind: z.literal('unavailable'),
      reason: text,
      fastestSeconds: seconds.optional(),
      limitSeconds: z.number().nonnegative().max(691200).optional(),
    }),
  ]),
  factors: routeSchema.shape.basis.shape.calculation.options[1].shape.factors,
  geographySource: z.strictObject({
    id: text,
    url: z.url().max(2048),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    licence: z.url().max(2048),
    attribution: z.string().min(1).max(2000),
  }),
  calculationStatus: z.enum(['indicative_demo', 'approved']),
  unsupportedModes: z.tuple([z.literal('cab'), z.literal('electric_car')]),
  outcomes: z
    .array(
      z.discriminatedUnion('kind', [
        z.strictObject({
          mode: routeInput.shape.modes.element,
          kind: z.literal('available'),
          count: z.number().int().min(1).max(3),
        }),
        z.strictObject({
          mode: routeInput.shape.modes.element,
          kind: z.literal('unavailable'),
          reason: text,
        }),
      ]),
    )
    .max(4),
});
export type JourneyPlanDisplay = z.infer<typeof planDisplaySchema>;

export function projectPlanDisplay(
  response: RouteQueryResult,
): JourneyPlanDisplay {
  const { result, recommendation } = response;
  return planDisplaySchema.parse({
    version: 1,
    source: result.kind === 'routes' ? result.source : null,
    fetchedAt: result.kind === 'routes' ? result.fetchedAt : null,
    modes: response.query.modes,
    extraMinutes: response.query.extraMinutes,
    routes:
      result.kind === 'routes'
        ? result.routes.map((route) => {
            const item = response.estimates.find(
              (item) => item.routeId === route.id,
            );
            if (!item)
              throw new Error(
                'Server route comparison is missing its estimate.',
              );
            return {
              routeId: route.id,
              mode: route.mode,
              availability: route.availability,
              distanceMeters: route.distanceMeters,
              durationSeconds: route.durationSeconds,
              legs: route.legs.map(
                ({ mode, distanceMeters, durationSeconds }) => ({
                  mode,
                  distanceMeters,
                  durationSeconds,
                }),
              ),
              estimate: item.estimate,
            };
          })
        : [],
    recommendation:
      recommendation.kind === 'recommended'
        ? {
            kind: recommendation.kind,
            routeId: recommendation.route.id,
            estimate: recommendation.estimate,
            baseline: recommendation.baseline,
            baselineDistanceMeters: recommendation.baselineDistanceMeters,
            fastestSeconds: recommendation.fastestSeconds,
            limitSeconds: recommendation.limitSeconds,
            avoidedKgCo2e: recommendation.avoidedKgCo2e,
          }
        : recommendation,
    factors: response.factors,
    geographySource: response.geographySource,
    calculationStatus: response.calculationStatus,
    unsupportedModes: response.unsupportedModes,
    outcomes: result.outcomes ?? [],
  });
}

export const planInput = z.strictObject({
  profileId: id,
  requestId: id,
  query: routeInput,
});
export const planSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('unavailable'),
    reason: z.string(),
    display: planDisplaySchema.optional(),
  }),
  z.strictObject({
    kind: z.literal('prepared'),
    display: planDisplaySchema.optional(),
    candidates: z
      .array(
        z.discriminatedUnion('kind', [
          z.strictObject({
            kind: z.literal('prepared'),
            routeId: z.string(),
            journey: summarySchema,
          }),
          z.strictObject({
            kind: z.literal('unavailable'),
            routeId: z.string(),
            reason: z.string(),
          }),
        ]),
      )
      .max(12),
  }),
]);
export type JourneyPlan = z.infer<typeof planSchema>;

// Input is only the actual in-process authenticated provider result, never HTTP JSON.
export function routeSnapshots(
  response: RouteQueryResult,
): ({ routeId: string } & (
  | { kind: 'available'; snapshot: RouteSnapshot }
  | { kind: 'unavailable'; reason: string }
))[] {
  if (response.result.kind !== 'routes') return [];
  const result = response.result;
  const baseline = result.routes
    .filter(
      (route) =>
        route.mode === 'car' &&
        route.availability.kind === 'available' &&
        route.durationSeconds !== null,
    )
    .sort(
      (a, b) =>
        (a.durationSeconds ?? Infinity) - (b.durationSeconds ?? Infinity) ||
        a.id.localeCompare(b.id),
    )[0];
  const baselineEvidence = result.evidence.find(
    (item) => item.routeId === baseline?.id,
  );
  return result.routes.map((route) => {
    const evidence = result.evidence.find((item) => item.routeId === route.id);
    if (route.availability.kind !== 'available')
      return {
        kind: 'unavailable',
        routeId: route.id,
        reason: 'unsupported_route',
      };
    if (!evidence || evidence.geometry.kind !== 'provider')
      return {
        kind: 'unavailable',
        routeId: route.id,
        reason: 'missing_geometry',
      };
    const applicable =
      evidence.factorApplicability === 'singapore_indicative' &&
      baselineEvidence?.factorApplicability === 'singapore_indicative' &&
      baselineEvidence.geometry.kind === 'provider';
    const parsed = routeSchema.safeParse({
      routeId: route.id,
      routeEvidence: {
        primaryMode: evidence.primaryMode,
        factorApplicability: evidence.factorApplicability,
        geographyVersion: response.geographySource.id,
      },
      source: result.source,
      fetchedAt: result.fetchedAt,
      query: response.query,
      mode: route.mode,
      start: evidence.geometry.start,
      end: evidence.geometry.end,
      points: evidence.geometry.points,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      legs: route.legs.map(({ mode, distanceMeters, durationSeconds }) => ({
        mode,
        distanceMeters,
        durationSeconds,
      })),
      basis: {
        ...(response.factorRelease
          ? { factorRelease: response.factorRelease }
          : {}),
        factorVersions: response.factors.map((factor) => factor.id),
        factorStatus: applicable ? response.calculationStatus : 'unavailable',
        earningRuleVersion: 'initial-50-cap-2000-v1',
        calculation:
          applicable && baseline
            ? {
                kind: 'available',
                baseline: {
                  routeId: baseline.id,
                  distanceMeters: baseline.distanceMeters,
                  durationSeconds: baseline.durationSeconds,
                  legs: baseline.legs.map(
                    ({ mode, distanceMeters, durationSeconds }) => ({
                      mode,
                      distanceMeters,
                      durationSeconds,
                    }),
                  ),
                  queryBinding: 'same_server_query',
                },
                factors: response.factors,
                earningRule: {
                  version: 'initial-50-cap-2000-v1',
                  pointsPerKg: 50,
                  journeyCap: 2000,
                },
              }
            : {
                kind: 'unavailable',
                reason: baseline
                  ? 'factor_applicability_unverified'
                  : 'missing_baseline',
              },
      },
    });
    return parsed.success
      ? { kind: 'available', routeId: route.id, snapshot: parsed.data }
      : {
          kind: 'unavailable',
          routeId: route.id,
          reason: 'unsupported_journey_bounds',
        };
  });
}
