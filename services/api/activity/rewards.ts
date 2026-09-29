import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { ApiError } from '../accounts/types.ts';
import { runPointsOperation } from '../points/index.ts';
import {
  activityReward,
  missionResult,
  type ActivityReward,
  type MissionResult,
} from './reward-contract.ts';
import { checkMissionEligibility } from './missions.ts';
import type { StoredActivityAssessment } from './assessment-store.ts';
import { activitySubmissionAssessmentResultSchema } from '../ai/activity-submission.ts';

const outcomeSchema = z.strictObject({
  reward: activityReward,
  mission: missionResult,
});
export type ActivitySettlementOutcome = z.infer<typeof outcomeSchema>;
const POLICY_VERSION = 'activity-reward-v1' as const;

function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function imageHashes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5)
    throw new ApiError(409, 'Assessment payload changed.');
  return value.map((hash) => {
    if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/u.test(hash))
      throw new ApiError(409, 'Assessment payload changed.');
    return hash;
  });
}

export async function settleAcceptedActivity(input: {
  pool: Pool;
  token: string;
  principalId: string;
  profileId: string;
  assessmentId: string;
  requestId: string;
  payloadDigest: string;
  missionId: string | null;
  imageHashes: string[];
  assessment: Extract<StoredActivityAssessment, { kind: 'accepted' }>;
  sourceContext?: 'production' | 'synthetic_test';
  signal?: AbortSignal;
}) {
  const sourceContext = input.sourceContext ?? 'production';
  if (sourceContext === 'synthetic_test' && process.env.NODE_ENV !== 'test')
    throw new ApiError(403, 'Synthetic accounting is test-only.');
  const hashes = imageHashes(input.imageHashes);
  const sorted = [...new Set(hashes)].sort();
  const intent = JSON.stringify([
    input.assessmentId,
    input.payloadDigest,
    input.missionId,
    POLICY_VERSION,
    sourceContext,
  ]);
  return runPointsOperation({
    pool: input.pool,
    token: input.token,
    access: 'owner' as const,
    request: {
      profileId: input.profileId,
      requestId: input.requestId,
      kind: 'activity_evidence',
    },
    intent,
    outcomeSchema,
    skipLedgerWhenZero: true,
    databaseTimeoutMs: 1200,
    perform: async ({ client, profile, actor, operationId }) => {
      if (actor.principalId !== input.principalId)
        throw new ApiError(403, 'Profile ownership changed.');
      if (input.signal?.aborted)
        throw new ApiError(409, 'Assessment is no longer awardable.');
      if (profile.kind !== 'real')
        throw new ApiError(409, 'Photo activity requires a real profile.');
      const assessment = await client.query<{
        id: string;
        profile_id: string;
        request_id: string;
        payload_digest: string;
        mission_id: string | null;
        status: string;
        image_hashes: unknown;
        result: unknown;
        expired: boolean;
      }>(
        `SELECT id, profile_id, request_id, payload_digest, mission_id, status, image_hashes, result,
                started_at < clock_timestamp() - interval '30 seconds' AS expired
         FROM app.activity_assessments WHERE id=$1 AND profile_id=$2 FOR UPDATE`,
        [input.assessmentId, profile.id],
      );
      const row = assessment.rows[0];
      if (
        !row ||
        row.request_id !== input.requestId ||
        row.payload_digest !== input.payloadDigest
      )
        throw new ApiError(409, 'Assessment payload changed.');
      if (row.status !== 'processing' && row.status !== 'accepted')
        throw new ApiError(409, 'Assessment is no longer awardable.');
      if (row.status === 'processing' && row.expired)
        throw new ApiError(409, 'Assessment expired before reward settlement.');
      if (row.mission_id !== input.missionId)
        throw new ApiError(409, 'Assessment payload changed.');
      const persistedHashes = imageHashes(row.image_hashes);
      if (digest(persistedHashes) !== digest(hashes))
        throw new ApiError(409, 'Assessment payload changed.');
      if (
        input.assessment.kind !== 'accepted' ||
        input.assessment.category === 'other' ||
        input.assessment.category === 'unclear' ||
        input.assessment.evidenceScore < 60 ||
        input.assessment.confidence <= 0.5
      )
        throw new ApiError(
          409,
          'Assessment does not meet the activity reward policy.',
        );
      for (const hash of sorted)
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 1809231))',
          [hash],
        );
      const freshness = await client.query<{ expired: boolean }>(
        `SELECT started_at < clock_timestamp() - interval '30 seconds' AS expired
         FROM app.activity_assessments WHERE id=$1`,
        [input.assessmentId],
      );
      if (freshness.rows[0]?.expired)
        throw new ApiError(409, 'Assessment expired before reward settlement.');
      if (input.signal?.aborted)
        throw new ApiError(409, 'Assessment is no longer awardable.');

      if (row.status === 'accepted') {
        const retained = activitySubmissionAssessmentResultSchema.parse(
          row.result,
        );
        if (retained.kind !== 'accepted')
          throw new ApiError(409, 'Assessment is no longer awardable.');
        const prior = retained.reward;
        const priorMission = retained.mission;
        const reward = prior ?? {
          kind: 'not_awarded' as const,
          points: 0 as const,
          reason: 'mission_ineligible' as const,
        };
        const mission = priorMission ?? { kind: 'none' as const };
        return {
          delta: 0,
          reason: 'Activity evidence replay.',
          outcome: { reward, mission },
        };
      }
      const existingClaim = await client.query<{ operation_id: string | null }>(
        'SELECT operation_id FROM app.activity_reward_claims WHERE assessment_id=$1 OR (profile_id=$2 AND request_id=$3) FOR UPDATE',
        [input.assessmentId, profile.id, input.requestId],
      );
      if (existingClaim.rows[0]?.operation_id) {
        const storedOperation = await client.query<{ outcome: unknown }>(
          'SELECT outcome FROM app.points_operations WHERE id=$1',
          [existingClaim.rows[0].operation_id],
        );
        const outcome = outcomeSchema.parse(storedOperation.rows[0]?.outcome);
        return { delta: 0, reason: 'Activity evidence replay.', outcome };
      }
      const eligibility = await checkMissionEligibility(
        client,
        profile.id,
        input.missionId,
        input.assessment.category,
      );
      let mission: MissionResult =
        eligibility.kind === 'none'
          ? { kind: 'none' }
          : eligibility.kind === 'ineligible'
            ? { kind: 'not_awarded', reason: eligibility.reason }
            : { kind: 'none' };
      if (eligibility.kind === 'ineligible') {
        const reward: ActivityReward = {
          kind: 'not_awarded',
          points: 0,
          reason: 'mission_ineligible',
        };
        const persisted = { ...input.assessment, reward, mission };
        await client.query(
          `UPDATE app.activity_assessments SET status='accepted', result=$1, completed_at=clock_timestamp() WHERE id=$2 AND status='processing'`,
          [persisted, input.assessmentId],
        );
        return {
          delta: 0,
          reason: 'Activity mission is ineligible.',
          outcome: { reward, mission },
        };
      }
      const duplicate = await client.query(
        'SELECT 1 FROM app.activity_credited_images WHERE image_hash = ANY($1::text[]) AND source_context=$2 LIMIT 1',
        [sorted, sourceContext],
      );
      if (duplicate.rowCount) {
        const reward: ActivityReward = {
          kind: 'not_awarded',
          points: 0,
          reason: 'duplicate_evidence',
        };
        const persisted = { ...input.assessment, reward, mission };
        await client.query(
          `UPDATE app.activity_assessments SET status='accepted', result=$1, completed_at=clock_timestamp() WHERE id=$2 AND status='processing'`,
          [persisted, input.assessmentId],
        );
        return {
          delta: 0,
          reason: 'Activity evidence was already credited.',
          outcome: { reward, mission },
        };
      }
      const day = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM app.activity_reward_claims
         WHERE profile_id=$1 AND credited_at >= date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
        [profile.id],
      );
      if (Number(day.rows[0]?.count ?? 0) >= 3) {
        const reward: ActivityReward = {
          kind: 'not_awarded',
          points: 0,
          reason: 'daily_cap',
        };
        const persisted = { ...input.assessment, reward, mission };
        await client.query(
          `UPDATE app.activity_assessments SET status='accepted', result=$1, completed_at=clock_timestamp() WHERE id=$2 AND status='processing'`,
          [persisted, input.assessmentId],
        );
        return {
          delta: 0,
          reason: 'Daily activity reward cap reached.',
          outcome: { reward, mission },
        };
      }
      const reward: ActivityReward = {
        kind: 'awarded',
        points: 50,
        receiptId: operationId,
        balanceAfter: profile.balance + 50,
        policyVersion: POLICY_VERSION,
      };
      if (eligibility.kind === 'eligible') {
        const next = eligibility.count + 1;
        mission = {
          kind: 'updated',
          missionId: input.missionId!,
          progress: next,
          target: eligibility.definition.target,
          completed: next >= eligibility.definition.target,
        };
        await client.query(
          'UPDATE app.mission_progress SET count=$1::integer, completed_at=CASE WHEN $1::integer >= $2::integer THEN clock_timestamp() ELSE completed_at END WHERE profile_id=$3 AND mission_id=$4',
          [next, eligibility.definition.target, profile.id, input.missionId],
        );
        await client.query(
          'INSERT INTO app.mission_events(id,event_key,profile_id,mission_id,assessment_id,delta,source_context) VALUES ($1,$2,$3,$4,$5,1,$6)',
          [
            randomUUID(),
            `${input.assessmentId}:${input.missionId}`,
            profile.id,
            input.missionId,
            input.assessmentId,
            sourceContext,
          ],
        );
      }
      await client.query(
        'INSERT INTO app.activity_reward_claims(assessment_id,operation_id,profile_id,request_id,payload_digest,image_hashes,source_context) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [
          input.assessmentId,
          operationId,
          profile.id,
          input.requestId,
          input.payloadDigest,
          JSON.stringify(hashes),
          sourceContext,
        ],
      );
      for (const hash of sorted)
        await client.query(
          'INSERT INTO app.activity_credited_images(image_hash,source_context,assessment_id) VALUES ($1,$2,$3)',
          [hash, sourceContext, input.assessmentId],
        );
      const persisted = { ...input.assessment, reward, mission };
      if (input.signal?.aborted)
        throw new ApiError(409, 'Assessment is no longer awardable.');
      await client.query(
        `UPDATE app.activity_assessments SET status='accepted', result=$1, completed_at=clock_timestamp() WHERE id=$2 AND status='processing'`,
        [persisted, input.assessmentId],
      );
      return {
        delta: 50,
        reason: 'Accepted activity evidence reward.',
        outcome: { reward, mission },
      };
    },
  });
}
