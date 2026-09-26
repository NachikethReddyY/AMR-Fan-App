import { z } from 'zod';
import type { Request } from '../account/api.ts';
import type { Context } from '../account/resource.ts';
const mode = z.enum([
  'bus',
  'train',
  'car',
  'electric_car',
  'cab',
  'walk',
  'cycle',
]);
const nonnegative = z.number().finite().nonnegative();
const route = z.object({
  id: z.string().min(1).max(200),
  mode,
  availability: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('available') }),
    z.object({ kind: z.literal('unavailable'), reason: z.string().max(500) }),
  ]),
  legs: z
    .array(
      z.object({
        mode,
        distanceMeters: nonnegative,
        durationSeconds: nonnegative,
        description: z.string().max(2000),
      }),
    )
    .max(128),
  distanceMeters: nonnegative.nullable(),
  durationSeconds: nonnegative.nullable(),
});
const estimated = z.object({
  kind: z.literal('estimated'),
  kgCo2e: nonnegative,
  factorIds: z.array(z.string().max(200)).max(128),
});
export const estimateSchema = z.discriminatedUnion('kind', [
  estimated,
  z.object({
    kind: z.literal('unavailable'),
    reason: z.string().min(1).max(100),
  }),
]);
const comparison = z.object({
  result: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('routes'),
      source: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('fixture'), label: z.string().max(500) }),
        z.object({ kind: z.literal('live'), provider: z.string().max(200) }),
      ]),
      routes: z.array(route).max(12),
    }),
    z.object({
      kind: z.literal('unavailable'),
      reason: z.string().min(1).max(100),
    }),
  ]),
  estimates: z
    .array(z.object({ routeId: z.string().max(200), estimate: estimateSchema }))
    .max(12),
  recommendation: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('unavailable'),
      reason: z.string().min(1).max(100),
    }),
    z.object({
      kind: z.literal('recommended'),
      route,
      estimate: estimated,
      baseline: estimated,
      baselineDistanceMeters: nonnegative,
      fastestSeconds: nonnegative,
      limitSeconds: nonnegative,
      avoidedKgCo2e: z.number().finite(),
    }),
  ]),
  factors: z
    .array(
      z.object({
        id: z.string().max(200),
        source: z.string().max(2000),
        period: z.string().max(200),
        method: z.string().max(1000),
        assumptions: z.string().max(2000),
      }),
    )
    .max(50),
  unsupportedModes: z.array(mode).max(7),
  calculationStatus: z.literal('indicative_demo'),
});
export type Comparison = z.infer<typeof comparison>;
export type TravelQuery = {
  origin: string;
  destination: string;
  extraMinutes: number;
};
export function parseComparison(raw: unknown) {
  const parsed = comparison.parse(raw);
  if (parsed.result.kind === 'routes') {
    const routes = parsed.result.routes;
    const ids = new Set(routes.map((r) => r.id));
    if (
      ids.size !== routes.length ||
      parsed.estimates.length !== routes.length ||
      new Set(parsed.estimates.map((e) => e.routeId)).size !== routes.length ||
      parsed.estimates.some((e) => !ids.has(e.routeId))
    )
      throw new Error('Invalid route estimates.');
    if (parsed.recommendation.kind === 'recommended') {
      const selected = parsed.recommendation.route;
      const match = routes.find((r) => r.id === selected.id);
      if (!match || JSON.stringify(match) !== JSON.stringify(selected))
        throw new Error('Invalid recommendation.');
    }
  } else if (
    parsed.estimates.length ||
    parsed.recommendation.kind === 'recommended'
  )
    throw new Error('Invalid unavailable routes.');
  return parsed;
}
export function createTravelApi(request: Request) {
  return async (ctx: Context, query: TravelQuery) =>
    parseComparison(
      await request('/v1/routes/query', ctx.token, 'POST', {
        ...query,
        modes: ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'],
      }),
    );
}
