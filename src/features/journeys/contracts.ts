import { z } from 'zod';
import { estimated, estimatedCo2, estimateSchema } from '../routes/api.ts';
import type { Journey as ServerJourney } from '../../../server/journeys/contracts';
import type { JourneyPlan as ServerPlan } from '../../../server/journeys/planning';
import type { AwardOutcome as ServerAward } from '../../../server/awards/contracts';

const id = z.uuid();
const time = z.number().int().nonnegative();
const mode = z.enum([
  'bus',
  'train',
  'car',
  'electric_car',
  'cab',
  'walk',
  'cycle',
]);
const source = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixture'), label: z.string() }),
  z.object({ kind: z.literal('live'), provider: z.string() }),
]);
const assessment = z.object({
  version: z.string(),
  revision: z.number().int().nonnegative(),
  calibration: z.enum(['unvalidated', 'physical_validated']),
  status: z.enum([
    'unfinished',
    'insufficient_evidence',
    'ineligible',
    'satisfies_configured_rules',
    'expired',
  ]),
  reasons: z.array(z.string()),
  startRecorded: z.boolean(),
  arrivalRecorded: z.boolean(),
  sampleCount: z.number().int().nonnegative(),
});
export const journeySchema = z.object({
  id,
  profileId: id,
  state: z.enum(['prepared', 'active', 'finished']),
  mode,
  source,
  startedAtMs: time.nullable(),
  finishedAtMs: time.nullable(),
  preciseExpiresAtMs: time,
  captureSessionId: id.nullable(),
  assessment,
});
export type Journey = z.infer<typeof journeySchema>;
// The phone validates only fields it consumes; server types prove their correspondence.
export const fromServerJourney = (value: ServerJourney): Journey =>
  journeySchema.parse(value);
const displayRoute = z.object({
  routeId: z.string(),
  mode,
  availability: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('available') }),
    z.object({ kind: z.literal('unavailable'), reason: z.string() }),
  ]),
  distanceMeters: z.number().nonnegative().nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  legs: z
    .array(
      z.object({
        mode,
        distanceMeters: z.number().nonnegative(),
        durationSeconds: z.number().nonnegative(),
      }),
    )
    .max(128),
  estimate: estimateSchema,
});
export const displaySchema = z.object({
  version: z.literal(1),
  source: source.nullable(),
  fetchedAt: z.iso.datetime().nullable(),
  extraMinutes: z.number().int().nonnegative(),
  routes: z.array(displayRoute).max(12),
  recommendation: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('unavailable'), reason: z.string() }),
    z.object({
      kind: z.literal('recommended'),
      routeId: z.string(),
      estimate: estimated,
      baseline: estimated,
      baselineDistanceMeters: z.number().nonnegative(),
      fastestSeconds: z.number().nonnegative(),
      limitSeconds: z.number().nonnegative(),
      avoidedKgCo2e: z.number(),
    }),
    z.object({
      kind: z.literal('recommended_co2'),
      gas: z.literal('CO2'),
      unit: z.literal('kgCO2'),
      routeId: z.string(),
      estimate: estimatedCo2,
      baseline: estimatedCo2,
      baselineDistanceMeters: z.number().nonnegative(),
      fastestSeconds: z.number().nonnegative(),
      limitSeconds: z.number().nonnegative(),
      avoidedKg: z.number(),
    }),
  ]),
  outcomes: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('available'),
          mode: z.string(),
          count: z.number(),
        }),
        z.object({
          kind: z.literal('unavailable'),
          mode: z.string(),
          reason: z.string(),
        }),
      ]),
    )
    .max(4),
});
export const planSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('unavailable'),
    reason: z.string(),
    display: displaySchema.optional(),
  }),
  z.object({
    kind: z.literal('prepared'),
    display: displaySchema.optional(),
    candidates: z
      .array(
        z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('prepared'),
            routeId: z.string(),
            journey: journeySchema,
          }),
          z.object({
            kind: z.literal('unavailable'),
            routeId: z.string(),
            reason: z.string(),
          }),
        ]),
      )
      .max(12),
  }),
]);
export type Plan = z.infer<typeof planSchema>;
export const fromServerPlan = (value: ServerPlan): Plan =>
  planSchema.parse(value);
export const sampleSchema = z.object({
  id,
  acquiredAtMs: time,
  receivedAtMs: time,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(100000).nullable(),
  context: z.enum(['foreground', 'background', 'unknown']),
  mocked: z.boolean().nullable(),
});
export type Sample = z.infer<typeof sampleSchema>;
export const finishReason = z.enum([
  'arrival',
  'stopped',
  'permission_revoked',
  'interrupted',
  'abandoned',
]);
export type FinishReason = z.infer<typeof finishReason>;
const calculation = z.object({
  measurement: z
    .object({
      version: z.literal('cag-surface-access-co2-v1'),
      gas: z.literal('CO2'),
      unit: z.literal('kgCO2'),
    })
    .optional(),
  arithmeticVersion: z.literal('floor-decimal-v1'),
  baselineKg: z
    .string()
    .max(1000)
    .regex(/^(0|[1-9]\d*)(\.\d+)?$/),
  journeyKg: z
    .string()
    .max(1000)
    .regex(/^(0|[1-9]\d*)(\.\d+)?$/),
  savingsKg: z
    .string()
    .max(1000)
    .regex(/^(0|[1-9]\d*)(\.\d+)?$/),
  targetPoints: z.number().int().nonnegative(),
});
export const awardSchema = z.object({
  creditedPoints: z.number().int().nonnegative(),
  cumulativeAutomaticCredit: z.number().int().nonnegative(),
  targetPoints: z.number().int().nonnegative(),
  creditContext: z.enum([
    'production_unavailable',
    'synthetic_test',
    'provisional',
    'production',
  ]),
  receipt: z.object({
    journeyId: id,
    profileId: id,
    result: z.object({
      productionCredit: z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('unavailable'),
          reasons: z.array(z.string()),
        }),
        z.object({ kind: z.literal('ready') }),
        z.object({
          kind: z.literal('provisional'),
          policyVersion: z.literal('planned-endpoints-v1'),
          factorReleaseVersion: z.string().min(1).max(160),
        }),
      ]),
      decision: z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('unavailable'),
          reasons: z.array(z.string()),
        }),
        z.object({ kind: z.literal('no_award'), reason: z.string() }),
        z.object({ kind: z.literal('full'), calculation }),
        z.object({
          kind: z.literal('fallback'),
          calculation,
          targetPoints: z.number().int().min(0).max(50),
        }),
        z.object({
          kind: z.literal('provisional'),
          calculation,
          assessedCalculation: calculation.nullable(),
        }),
      ]),
    }),
  }),
});
export type Award = z.infer<typeof awardSchema>;
export const settlementSchema = z.object({
  entry: z.object({ profileId: id }),
  outcome: awardSchema,
});
export const fromServerAward = (value: ServerAward): Award =>
  awardSchema.parse(value);
export const listSchema = z.object({
  profileId: id,
  items: z
    .array(
      journeySchema.pick({
        id: true,
        state: true,
        mode: true,
        source: true,
        startedAtMs: true,
        finishedAtMs: true,
        preciseExpiresAtMs: true,
      }),
    )
    .max(50),
  nextCursor: z.string().nullable(),
});
export type JourneyList = z.infer<typeof listSchema>;
