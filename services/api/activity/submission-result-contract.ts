import { z } from 'zod';
import { activityReward, missionResult } from './reward-contract.ts';

/** Data-only contracts shared by the API and app capability/recovery clients. */
export const activityCategories = [
  'cleanup',
  'reuse_refill',
  'repair',
  'active_transport',
  'volunteering',
  'planting',
  'other',
  'unclear',
] as const;
const boundedEvidenceText = z.string().min(1).max(500).regex(/\S/u);
const modelCategory = z
  .string()
  .min(1)
  .max(64)
  .transform((value, ctx) => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/gu, '_');
    const alias = normalized.replace(/_/gu, '');
    for (const category of activityCategories) {
      if (category === normalized || category.replace(/_/gu, '') === alias)
        return category;
    }
    if (alias === 'recycling' || alias === 'cleanup' || alias === 'cleaning')
      return 'cleanup';
    if (alias === 'reuse' || alias === 'reuse_refill' || alias === 'refill')
      return 'reuse_refill';
    if (
      alias === 'transport' ||
      alias === 'activetransport' ||
      alias === 'walking' ||
      alias === 'cycling' ||
      alias === 'bus' ||
      alias === 'train'
    )
      return 'active_transport';
    if (alias === 'gardening' || alias === 'treeplanting') return 'planting';
    if (alias === 'unclear' || alias === 'unknown') return 'unclear';
    return 'other';
  });
export const activityAssessmentOutputSchema = z.strictObject({
  category: modelCategory,
  evidenceScore: z.number().finite().int().min(0).max(100),
  confidence: z.number().finite().min(0).max(1),
  rationale: boundedEvidenceText,
  evidenceItems: z.array(z.string().min(1).max(200).regex(/\S/u)).min(1).max(8),
  modelVersion: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9._:-]+$/u),
});
export type ActivityAssessmentOutput = z.infer<
  typeof activityAssessmentOutputSchema
>;

const policyVersion = 'activity-evidence-v1' as const;
export const activitySubmissionAssessmentResultSchema = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({
      kind: z.literal('accepted'),
      assessmentId: z.uuid(),
      ...activityAssessmentOutputSchema.shape,
      policyVersion: z.literal(policyVersion),
      reward: activityReward.optional(),
      mission: missionResult.optional(),
    }),
    z.strictObject({
      kind: z.literal('uncertain'),
      reason: z.enum(['low_confidence', 'unclear', 'invalid_evidence']),
      rationale: boundedEvidenceText,
    }),
    z.strictObject({
      kind: z.literal('rejected'),
      reason: z.enum(['unsupported_activity', 'invalid_evidence']),
      rationale: boundedEvidenceText,
    }),
    z.strictObject({
      kind: z.literal('cancelled'),
      reason: z.literal('request_cancelled'),
    }),
    z.strictObject({
      kind: z.literal('expired'),
      reason: z.literal('assessment_expired'),
    }),
    z.strictObject({
      kind: z.literal('unavailable'),
      reason: z.enum([
        'disabled',
        'busy',
        'timeout',
        'provider',
        'invalid_output',
      ]),
    }),
  ],
);
export type ActivitySubmissionAssessmentResult = z.infer<
  typeof activitySubmissionAssessmentResultSchema
>;

export const activitySubmissionReplaySchema = z.strictObject({
  kind: z.literal('replay'),
  result: activitySubmissionAssessmentResultSchema,
});
export const activitySubmissionRecoverySchema = z.union([
  activitySubmissionAssessmentResultSchema,
  activitySubmissionReplaySchema,
]);
export type ActivitySubmissionRecovery = z.infer<
  typeof activitySubmissionRecoverySchema
>;

export const activitySubmissionAvailabilitySchema = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({
      kind: z.literal('available'),
      mode: z.enum(['synthetic_test', 'production']),
      limits: z.strictObject({
        photos: z.literal(5),
        description: z.literal(1600),
      }),
    }),
    z.strictObject({
      kind: z.literal('unavailable'),
      reason: z.literal('disabled'),
    }),
  ],
);
export type ActivitySubmissionAvailability = z.infer<
  typeof activitySubmissionAvailabilitySchema
>;

export const activitySubmissionRequestSchema = z.strictObject({
  requestId: z.uuid(),
  description: z.string().min(1).max(1600),
  photos: z
    .array(
      z.strictObject({
        mime: z.enum(['image/jpeg', 'image/png']),
        base64: z
          .string()
          .min(4)
          .max(2_796_204)
          .regex(
            /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u,
          ),
      }),
    )
    .min(1)
    .max(5),
  missionId: z.uuid().nullable(),
  journeyId: z.uuid().nullable().optional(),
});
export type ActivitySubmissionRequest = z.infer<
  typeof activitySubmissionRequestSchema
>;
