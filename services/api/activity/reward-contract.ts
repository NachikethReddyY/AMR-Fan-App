import { z } from 'zod';

export const rewardPolicyVersion = z.literal('activity-reward-v1');
export const activityReward = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('awarded'),
    points: z.literal(50),
    receiptId: z.uuid(),
    balanceAfter: z.number().int().nonnegative(),
    policyVersion: rewardPolicyVersion,
  }),
  z.strictObject({
    kind: z.literal('not_awarded'),
    points: z.literal(0),
    reason: z.enum(['daily_cap', 'duplicate_evidence', 'mission_ineligible']),
  }),
]);
export type ActivityReward = z.infer<typeof activityReward>;

export const missionResult = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({
    kind: z.literal('updated'),
    missionId: z.uuid(),
    progress: z.number().int().nonnegative(),
    target: z.number().int().positive(),
    completed: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal('not_awarded'),
    reason: z.enum([
      'mission_ineligible',
      'not_enrolled',
      'expired',
      'upcoming',
      'archived',
      'category_mismatch',
      'version_mismatch',
      'completed',
      'duplicate_event',
    ]),
  }),
]);
export type MissionResult = z.infer<typeof missionResult>;

export const missionCategory = z.enum([
  'cleanup',
  'reuse_refill',
  'repair',
  'active_transport',
  'volunteering',
]);
export type MissionCategory = z.infer<typeof missionCategory>;
const progressState = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('not_enrolled'), count: z.literal(0) }),
  z.strictObject({
    kind: z.literal('enrolled'),
    count: z.number().int().nonnegative(),
  }),
  z.strictObject({
    kind: z.literal('completed'),
    count: z.number().int().nonnegative(),
  }),
]);
export const missionListEntry = z.strictObject({
  id: z.uuid(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  category: missionCategory,
  kind: z.enum(['personal', 'race_week']),
  target: z.number().int().positive(),
  communityTarget: z.number().int().positive().nullable(),
  policyVersion: z.string().min(1).max(80),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  timezone: z.string().min(1).max(100),
  status: z.enum(['active', 'archived']),
  version: z.number().int().positive(),
  availability: z.enum(['upcoming', 'active', 'expired', 'unavailable']),
  progress: progressState,
  communityProgress: z.number().int().nonnegative(),
  attribution: z.strictObject({ sourceLabel: z.string().min(1).max(200) }),
});
export type MissionListEntry = z.infer<typeof missionListEntry>;
export const missionsResponse = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('available'),
    missions: z.array(missionListEntry).max(20),
    recommendedMissionId: z.uuid().nullable(),
  }),
  z.strictObject({
    kind: z.literal('unavailable'),
    reason: z.literal('demo_profile'),
    missions: z.array(missionListEntry).length(0),
    recommendedMissionId: z.null(),
  }),
]);
export const missionEnrollmentResponse = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('enrolled'),
    missionId: z.uuid(),
    version: z.number().int().positive(),
  }),
  z.strictObject({
    kind: z.literal('already_enrolled'),
    missionId: z.uuid(),
    version: z.number().int().positive(),
  }),
]);
