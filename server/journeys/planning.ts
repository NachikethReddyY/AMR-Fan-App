import { z } from 'zod';
import { routeInput } from '../routes/provider.ts';
import type { RouteQueryResult } from '../routes/query.ts';
import {
  id,
  routeSchema,
  summarySchema,
  type RouteSnapshot,
} from './contracts.ts';

export const planInput = z.strictObject({
  profileId: id,
  requestId: id,
  query: routeInput,
});
export const planSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('unavailable'), reason: z.string() }),
  z.strictObject({
    kind: z.literal('prepared'),
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
