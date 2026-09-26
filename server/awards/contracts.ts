import { z } from 'zod';
import {
  id,
  assessmentSchema,
  sourceSchema,
  summarySchema,
} from '../journeys/contracts.ts';
import { points } from '../points/contracts.ts';

export const settlementInput = z.strictObject({
  profileId: id,
  requestId: id,
  assessmentVersion: z.string().min(1).max(160),
  assessmentRevision: z.number().int().nonnegative(),
});
const exactKg = z
  .string()
  .max(1000)
  .regex(/^(0|[1-9]\d*)(\.\d+)?$/);
export const calculationSchema = z.strictObject({
  arithmeticVersion: z.literal('floor-decimal-v1'),
  baselineKg: exactKg,
  journeyKg: exactKg,
  savingsKg: exactKg,
  targetPoints: points,
});
export const decisionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('full'), calculation: calculationSchema }),
  z.strictObject({
    kind: z.literal('provisional'),
    calculation: calculationSchema,
    assessedCalculation: calculationSchema.nullable(),
  }),
  z.strictObject({
    kind: z.literal('fallback'),
    calculation: calculationSchema,
    targetPoints: points.max(50),
  }),
  z.strictObject({ kind: z.literal('no_award'), reason: z.string() }),
  z.strictObject({
    kind: z.literal('unavailable'),
    reasons: z.array(z.string()),
  }),
]);
export const policyResultSchema = z.strictObject({
  decision: decisionSchema,
  productionCredit: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('unavailable'),
      reasons: z.array(z.string()).min(1),
    }),
    z.strictObject({
      kind: z.literal('provisional'),
      policyVersion: z.literal('planned-endpoints-v1'),
      factorReleaseVersion: z.string().min(1),
    }),
    z.strictObject({
      kind: z.literal('ready'),
      version: z.literal('journey-award-readiness-v1'),
      releaseVersion: z.string().min(1),
    }),
  ]),
});
export type PolicyResult = z.infer<typeof policyResultSchema>;

// Reuse journey-owned schemas for retained provenance, never parse a shadow Journey.
export const receiptSchema = z.strictObject({
  journeyId: id,
  profileId: id,
  assessmentIdentity: z.strictObject({
    journeyId: id,
    version: z.string(),
    revision: z.number().int().nonnegative(),
  }),
  source: sourceSchema,
  routeEvidence: summarySchema.shape.routeEvidence,
  basis: summarySchema.shape.basis,
  earningPolicy: summarySchema.shape.earningPolicy,
  selectedLegs: summarySchema.shape.selectedLegs,
  assessedLegs: summarySchema.shape.assessedLegs,
  assessment: assessmentSchema,
  startedAtMs: summarySchema.shape.startedAtMs,
  finishedAtMs: summarySchema.shape.finishedAtMs,
  finishReason: summarySchema.shape.finishReason,
  mode: summarySchema.shape.mode,
  policy: summarySchema.shape.policy,
  awardRelease: summarySchema.shape.awardRelease,
  awardPolicy: summarySchema.shape.awardPolicy,
  result: policyResultSchema,
});
export type AwardReceipt = z.infer<typeof receiptSchema>;
export const outcomeSchema = z.strictObject({
  receipt: receiptSchema,
  creditContext: z.enum([
    'production_unavailable',
    'production',
    'provisional',
    'synthetic_test',
  ]),
  targetPoints: points,
  creditedPoints: points,
  cumulativeAutomaticCredit: points.max(2000),
});
export type AwardOutcome = z.infer<typeof outcomeSchema>;
