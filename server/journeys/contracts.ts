import { z } from 'zod';
import { ApiError } from '../accounts/types.ts';

export const retentionMs = 7 * 24 * 60 * 60 * 1000;
export const id = z.uuid();
export const timestamp = z.number().int().min(0).max(8_640_000_000_000_000);
export const coordinate = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
const mode = z.enum([
  'bus',
  'train',
  'car',
  'electric_car',
  'cab',
  'walk',
  'cycle',
]);
const version = z.string().min(1).max(160);
export const sourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('fixture'),
    label: z.string().min(1).max(160),
  }),
  z.strictObject({
    kind: z.literal('live'),
    provider: z.string().min(1).max(80),
  }),
]);
export const routeSchema = z.strictObject({
  routeId: z.string().min(1).max(160),
  source: sourceSchema,
  fetchedAt: z.iso.datetime(),
  query: z.strictObject({
    origin: z.string().min(1).max(500),
    destination: z.string().min(1).max(500),
  }),
  mode,
  start: coordinate,
  end: coordinate,
  points: z.array(coordinate).min(2).max(2048),
  distanceMeters: z.number().positive().max(1_000_000),
  durationSeconds: z.number().positive().max(604800),
  legs: z
    .array(
      z.strictObject({
        mode,
        distanceMeters: z.number().nonnegative().max(1_000_000),
        durationSeconds: z.number().nonnegative().max(604800),
      }),
    )
    .min(1)
    .max(128),
  basis: z.strictObject({
    factorVersions: z.array(version).max(128),
    factorStatus: z.enum(['indicative_demo', 'approved', 'unavailable']),
    earningRuleVersion: version,
  }),
});
export type RouteSnapshot = z.infer<typeof routeSchema>;
export const policySchema = z.strictObject({
  version,
  calibration: z.literal('unvalidated'),
  accuracyMeters: z.number().positive().max(50),
  endpointMeters: z.number().positive().max(100),
  endpointFreshnessMs: z.number().int().positive().max(30000),
  corridorMeters: z.number().positive().max(100),
  continuityGapMs: z.number().int().positive().max(120000),
});
export const candidatePolicy: z.infer<typeof policySchema> = {
  version: 'journey-calibration-v1',
  calibration: 'unvalidated',
  accuracyMeters: 50,
  endpointMeters: 100,
  endpointFreshnessMs: 30000,
  corridorMeters: 100,
  continuityGapMs: 120000,
};
export type EvidencePolicy = z.infer<typeof policySchema>;
export const sampleSchema = z.strictObject({
  id,
  acquiredAtMs: timestamp,
  receivedAtMs: timestamp,
  latitude: coordinate.shape.latitude,
  longitude: coordinate.shape.longitude,
  accuracyMeters: z.number().nonnegative().max(100000).nullable(),
  context: z.enum(['foreground', 'background', 'unknown']),
  mocked: z.boolean().nullable(),
});
export type LocationSample = z.infer<typeof sampleSchema>;
export const assessmentSchema = z.strictObject({
  version,
  calibration: z.literal('unvalidated'),
  revision: z.number().int().nonnegative(),
  status: z.enum([
    'unfinished',
    'insufficient_evidence',
    'contradictory_evidence',
    'candidate_supported',
    'expired',
  ]),
  reasons: z.array(z.string()),
  startRecorded: z.boolean(),
  arrivalRecorded: z.boolean(),
  sampleCount: z.number().int().nonnegative(),
  elapsedMs: z.number().nonnegative().nullable(),
  observedDistanceMeters: z.number().nonnegative(),
});
export type Assessment = z.infer<typeof assessmentSchema>;
export const summarySchema = z.strictObject({
  id,
  profileId: id,
  state: z.enum(['prepared', 'active', 'finished']),
  source: sourceSchema,
  mode,
  basis: routeSchema.shape.basis,
  policy: policySchema,
  preparedAtMs: timestamp,
  startedAtMs: timestamp.nullable(),
  finishedAtMs: timestamp.nullable(),
  finishReason: z
    .enum([
      'arrival',
      'stopped',
      'permission_revoked',
      'interrupted',
      'abandoned',
    ])
    .nullable(),
  captureSessionId: id.nullable(),
  preciseExpiresAtMs: timestamp,
  evidenceRevision: z.number().int().nonnegative(),
  assessment: assessmentSchema,
});
export type Journey = z.infer<typeof summarySchema>;
export const prepareSchema = z.strictObject({ profileId: id, requestId: id });
export const startSchema = z.strictObject({
  requestId: id,
  captureSessionId: id,
});
export const batchSchema = z.strictObject({
  requestId: id,
  captureSessionId: id,
  samples: z.array(sampleSchema).min(1).max(100),
});
export const finishSchema = z.strictObject({
  requestId: id,
  captureSessionId: id,
  endedAtMs: timestamp,
  reason: summarySchema.shape.finishReason.unwrap(),
});

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, 'Invalid journey input.');
  return result.data;
}
