import { z } from 'zod';
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
export const estimated = z.object({
  kind: z.literal('estimated'),
  kgCo2e: nonnegative,
  factorIds: z.array(z.string().max(200)).max(128),
});
export const estimatedCo2 = z.object({
  kind: z.literal('estimated_co2'),
  gas: z.literal('CO2'),
  unit: z.literal('kgCO2'),
  kg: nonnegative,
  factorIds: z.array(z.string().max(200)).max(128),
});
export const estimateSchema = z.discriminatedUnion('kind', [
  estimated,
  estimatedCo2,
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
    z.object({
      kind: z.literal('recommended_co2'),
      gas: z.literal('CO2'),
      unit: z.literal('kgCO2'),
      route,
      estimate: estimatedCo2,
      baseline: estimatedCo2,
      baselineDistanceMeters: nonnegative,
      fastestSeconds: nonnegative,
      limitSeconds: nonnegative,
      avoidedKg: z.number().finite(),
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
  calculationStatus: z.enum(['indicative_demo', 'approved']),
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
    if (parsed.recommendation.kind !== 'unavailable') {
      const selected = parsed.recommendation.route;
      const match = routes.find((r) => r.id === selected.id);
      if (!match || JSON.stringify(match) !== JSON.stringify(selected))
        throw new Error('Invalid recommendation.');
      const estimate = parsed.estimates.find(
        (e) => e.routeId === selected.id,
      )?.estimate;
      if (
        JSON.stringify(estimate) !==
        JSON.stringify(parsed.recommendation.estimate)
      )
        throw new Error('Recommendation estimate does not match its route.');
    }
  } else if (
    parsed.estimates.length ||
    parsed.recommendation.kind !== 'unavailable'
  )
    throw new Error('Invalid unavailable routes.');
  return parsed;
}
