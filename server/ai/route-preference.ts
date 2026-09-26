import { z } from 'zod';

const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
const route = z.strictObject({
  id,
  durationSeconds: z.number().finite().positive().max(604800),
  kgCo2e: z.number().finite().nonnegative().max(1_000_000).nullable(),
  points: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
});
const snapshotSchema = z
  .strictObject({
    snapshotId: id,
    extraMinutes: z.int().min(0).max(1440),
    routes: z.array(route).min(1).max(12),
  })
  .refine(
    (value) =>
      new Set(value.routes.map((item) => item.id)).size === value.routes.length,
  );
const preferenceSchema = z.strictObject({
  snapshotId: id,
  orderedRouteIds: z.array(id).min(1).max(12),
  confidence: z.number().finite().min(0).max(1).nullable().default(null),
});

export type RoutePreferenceResult =
  | {
      kind: 'unavailable';
      reason: 'invalid-input' | 'invalid-output' | 'missing-metrics';
      fallback: 'deterministic';
    }
  | {
      kind: 'preference';
      snapshotId: string;
      routes: z.infer<typeof route>[];
      limitSeconds: number;
      confidence: number | null;
    };

/** Select before remote inference so ineligible options never enter model state. */
export function prepareRoutePreference(input: unknown) {
  const snapshot = snapshotSchema.safeParse(input);
  if (!snapshot.success)
    return {
      kind: 'unavailable',
      reason: 'invalid-input',
      fallback: 'deterministic',
    } as const;
  if (
    snapshot.data.routes.some(
      (item) => item.kgCo2e === null || item.points === null,
    )
  )
    return {
      kind: 'unavailable',
      reason: 'missing-metrics',
      fallback: 'deterministic',
    } as const;
  const limitSeconds =
    Math.min(...snapshot.data.routes.map((item) => item.durationSeconds)) +
    snapshot.data.extraMinutes * 60;
  return {
    kind: 'prepared' as const,
    snapshot: snapshot.data,
    limitSeconds,
    eligible: snapshot.data.routes.filter(
      (item) => item.durationSeconds <= limitSeconds,
    ),
  };
}

/** Normalized internal boundary, not a Jev gateway parser. No I/O or arithmetic from the model. */
export function validateRoutePreference(
  input: unknown,
  response: unknown,
): RoutePreferenceResult {
  const fail = (
    reason: 'invalid-input' | 'invalid-output' | 'missing-metrics',
  ): RoutePreferenceResult => ({
    kind: 'unavailable',
    reason,
    fallback: 'deterministic',
  });
  const prepared = prepareRoutePreference(input);
  if (prepared.kind === 'unavailable') return prepared;
  const { snapshot, limitSeconds, eligible } = prepared;
  const parsed = preferenceSchema.safeParse(response);
  if (!parsed.success || parsed.data.snapshotId !== snapshot.snapshotId)
    return fail('invalid-output');
  const ids = parsed.data.orderedRouteIds;
  if (ids.length !== eligible.length || new Set(ids).size !== ids.length)
    return fail('invalid-output');
  const routes: z.infer<typeof route>[] = [];
  for (const routeId of ids) {
    const original = eligible.find((item) => item.id === routeId);
    if (!original) return fail('invalid-output');
    routes.push(original);
  }
  return {
    kind: 'preference',
    snapshotId: snapshot.snapshotId,
    routes,
    limitSeconds,
    confidence: parsed.data.confidence,
  };
}
