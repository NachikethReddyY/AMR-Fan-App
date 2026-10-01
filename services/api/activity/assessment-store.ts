import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { transaction } from '../database/index.ts';
import { ApiError } from '../accounts/types.ts';
import type { ActivitySubmissionAssessmentResult } from '../ai/activity-submission.ts';
import { activitySubmissionAssessmentResultSchema } from '../ai/activity-submission.ts';

const resultSchema = activitySubmissionAssessmentResultSchema;
export type StoredActivityAssessment = z.infer<typeof resultSchema>;

const hash = z.string().regex(/^[0-9a-f]{64}$/u);
const hashes = z.array(hash).min(1).max(5);
const processingTtlSeconds = 30;
const maxGlobalAssessments = 8;
const staleProcessingResult: StoredActivityAssessment = {
  kind: 'expired',
  reason: 'assessment_expired',
};

function statusFor(result: StoredActivityAssessment) {
  return result.kind;
}

function validateStoredResult(value: unknown): StoredActivityAssessment {
  const parsed = resultSchema.parse(value);
  if (
    parsed.kind === 'accepted' &&
    (parsed.category === 'other' ||
      parsed.category === 'unclear' ||
      parsed.evidenceScore < 60 ||
      parsed.confidence <= 0.5)
  )
    throw new ApiError(
      400,
      'Activity assessment does not meet the server policy.',
    );
  return parsed;
}

function stored(row: Record<string, unknown>): StoredActivityAssessment {
  return validateStoredResult(row.result);
}

export type BeginAssessmentInput = {
  pool: Pool;
  principalId: string;
  profileId: string;
  requestId: string;
  payloadDigest: string;
  missionId: string | null;
  journeyId?: string | null;
  imageHashes: string[];
};
export type BeginAssessmentResult =
  | { kind: 'started'; id: string }
  | { kind: 'replay'; result: StoredActivityAssessment }
  | { kind: 'busy' };

/** Reserve a durable owner-scoped request key before any provider work. */
export async function beginAssessment(
  input: BeginAssessmentInput,
): Promise<BeginAssessmentResult> {
  hash.parse(input.payloadDigest);
  hashes.parse(input.imageHashes);
  const requestId = z.uuid().parse(input.requestId).toLowerCase();
  const journeyId = input.journeyId ?? null;
  return transaction(input.pool, async (client) => {
    // One short global admission transaction coordinates every API instance.
    // Provider I/O always happens after commit, with at most eight active keys.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('activity-assessment-admission-v1', 0))",
    );
    // A missing unique row does not acquire a PostgreSQL row lock. Serialize
    // this request key before the lookup so concurrent first submissions cannot
    // both reserve provider work.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 48136291))',
      [`${input.profileId}:${requestId}`],
    );
    const profile = await client.query<{ kind: string }>(
      'SELECT kind FROM app.profiles WHERE id=$1 AND principal_id=$2 FOR SHARE',
      [input.profileId, input.principalId],
    );
    const profileRow = profile.rows[0];
    if (!profileRow) throw new ApiError(404, 'Profile not found.');
    if (profileRow.kind !== 'real')
      throw new ApiError(409, 'Photo activity requires a real profile.');
    if (journeyId) {
      const journey = await client.query(
        'SELECT 1 FROM app.journeys WHERE id=$1 AND profile_id=$2',
        [journeyId, input.profileId],
      );
      if (!journey.rowCount) throw new ApiError(404, 'Journey not found.');
    }

    const existing = await client.query<Record<string, unknown>>(
      `SELECT id, status, payload_digest, result, started_at
       FROM app.activity_assessments WHERE profile_id=$1 AND request_id=$2 FOR UPDATE`,
      [input.profileId, requestId],
    );
    const row = existing.rows[0];
    if (row) {
      if (row.payload_digest !== input.payloadDigest)
        throw new ApiError(
          409,
          'Request ID was already used for a different submission.',
        );
      if (row.status === 'processing') {
        const stale = await client.query<{ expired: boolean }>(
          `SELECT started_at < clock_timestamp() - make_interval(secs => $1::double precision) AS expired
           FROM app.activity_assessments WHERE id=$2`,
          [processingTtlSeconds, row.id],
        );
        if (!stale.rows[0]?.expired) return { kind: 'busy' };
        await client.query(
          `UPDATE app.activity_assessments SET status='expired', result=$1, completed_at=clock_timestamp()
           WHERE id=$2 AND status='processing'`,
          [staleProcessingResult, row.id],
        );
        return { kind: 'replay', result: staleProcessingResult };
      }
      return { kind: 'replay', result: stored(row) };
    }
    const admitted = await client.query<{ total: number; profile: number }>(
      `SELECT
        count(*) FILTER (WHERE status='processing' AND started_at >= clock_timestamp() - make_interval(secs => $1::double precision))::int AS total,
        count(*) FILTER (WHERE profile_id=$2 AND status='processing' AND started_at >= clock_timestamp() - make_interval(secs => $1::double precision))::int AS profile
       FROM app.activity_assessments`,
      [processingTtlSeconds, input.profileId],
    );
    if (
      (admitted.rows[0]?.total ?? maxGlobalAssessments) >=
        maxGlobalAssessments ||
      (admitted.rows[0]?.profile ?? 1) >= 1
    )
      return { kind: 'busy' };
    const id = randomUUID();
    await client.query(
      `INSERT INTO app.activity_assessments
       (id, profile_id, request_id, payload_digest, mission_id, journey_id, status, image_hashes, result)
       VALUES ($1,$2,$3,$4,$5,$6,'processing',$7,$8)`,
      [
        id,
        input.profileId,
        requestId,
        input.payloadDigest,
        input.missionId,
        journeyId,
        JSON.stringify(input.imageHashes),
        { kind: 'unavailable', reason: 'busy' },
      ],
    );
    return { kind: 'started', id };
  });
}

export async function completeAssessment(input: {
  pool: Pool;
  id: string;
  payloadDigest: string;
  result: ActivitySubmissionAssessmentResult;
}): Promise<StoredActivityAssessment> {
  const id = z.uuid().parse(input.id);
  const digest = hash.parse(input.payloadDigest);
  const result = validateStoredResult(input.result);
  return transaction(input.pool, async (client) => {
    const existing = await client.query<{
      status: string;
      payload_digest: string;
      result: unknown;
      started_at: Date;
    }>(
      'SELECT status, payload_digest, result, started_at FROM app.activity_assessments WHERE id=$1 FOR UPDATE',
      [id],
    );
    const row = existing.rows[0];
    if (!row) throw new ApiError(404, 'Assessment not found.');
    if (row.payload_digest !== digest)
      throw new ApiError(409, 'Assessment payload changed.');
    if (row.status !== 'processing') return validateStoredResult(row.result);
    if (row.started_at.getTime() < Date.now() - processingTtlSeconds * 1000) {
      await client.query(
        `UPDATE app.activity_assessments SET status='expired', result=$1, completed_at=clock_timestamp()
         WHERE id=$2 AND status='processing'`,
        [staleProcessingResult, id],
      );
      return staleProcessingResult;
    }
    const persisted =
      result.kind === 'accepted' ? { ...result, assessmentId: id } : result;
    await client.query(
      `UPDATE app.activity_assessments SET status=$1, result=$2, completed_at=clock_timestamp()
       WHERE id=$3 AND status='processing'`,
      [statusFor(persisted), persisted, id],
    );
    return persisted;
  });
}

async function readOwnedAssessment(input: {
  pool: Pool;
  principalId: string;
  profileId: string;
  where: string;
  value: string;
}) {
  return transaction(input.pool, async (client) => {
    const result = await client.query<
      Record<string, unknown> & { started_at: Date }
    >(
      `SELECT a.* FROM app.activity_assessments a
       JOIN app.profiles p ON p.id=a.profile_id
       WHERE ${input.where} AND a.profile_id=$2 AND p.principal_id=$3
       FOR UPDATE`,
      [input.value, input.profileId, input.principalId],
    );
    const row = result.rows[0];
    if (!row) throw new ApiError(404, 'Assessment not found.');
    if (row.status === 'processing') {
      if (row.started_at.getTime() < Date.now() - processingTtlSeconds * 1000) {
        await client.query(
          `UPDATE app.activity_assessments SET status='expired', result=$1, completed_at=clock_timestamp()
           WHERE id=$2 AND status='processing'`,
          [staleProcessingResult, row.id],
        );
        return { kind: 'replay' as const, result: staleProcessingResult };
      }
      return { kind: 'busy' as const };
    }
    return { kind: 'replay' as const, result: stored(row) };
  });
}

export function readAssessment(input: {
  pool: Pool;
  principalId: string;
  profileId: string;
  id: string;
}) {
  const id = z.uuid().parse(input.id);
  return readOwnedAssessment({
    pool: input.pool,
    principalId: input.principalId,
    profileId: input.profileId,
    where: 'a.id=$1',
    value: id,
  });
}

export function readAssessmentByRequest(input: {
  pool: Pool;
  principalId: string;
  profileId: string;
  requestId: string;
}) {
  const requestId = z.uuid().parse(input.requestId).toLowerCase();
  return readOwnedAssessment({
    pool: input.pool,
    principalId: input.principalId,
    profileId: input.profileId,
    where: 'a.request_id=$1',
    value: requestId,
  });
}
