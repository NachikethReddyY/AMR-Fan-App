import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../accounts/types.ts';
import { readOwnedProfile } from '../accounts/store.ts';
import { authenticateSession } from '../auth/session.ts';
import { transaction } from '../database/index.ts';
import { runPointsOperation } from '../points/index.ts';
import {
  SUBMISSION_FEE,
  adminPageInput,
  decisionInput,
  pageInput,
  parse,
  parseSubmissionInput,
  submission,
  uuid,
} from './contracts.ts';

const columns = `s.id, s.sequence::text, s.owner_profile_id AS "ownerProfileId", p.kind AS "profileKind",
  s.points_operation_id AS "pointsOperationId", s.text, s.tag, s.fee, 0 AS "rankingPoints",
  s.resubmission_of AS "resubmissionOf",
  to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
  COALESCE(d.status, 'pending') AS status, d.admin_id AS "moderatedBy",
  to_char(d.decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "moderatedAt"`;
const source = `app.fan_submissions s JOIN app.profiles p ON p.id = s.owner_profile_id
  LEFT JOIN app.fan_submission_decisions d ON d.submission_id = s.id`;

async function readSubmission(client: PoolClient, id: string) {
  const result = await client.query<Record<string, unknown>>(
    `SELECT ${columns} FROM ${source} WHERE s.id = $1`,
    [id],
  );
  if (!result.rows[0]) throw new ApiError(404, 'Submission not found.');
  return submission.parse(result.rows[0]);
}

// Read/moderation transactions hold current authority through commit, like points operations.
async function authorize(
  client: PoolClient,
  principalId: string,
  token: string,
  admin: boolean,
) {
  const principal = await client.query<{ role: string }>(
    'SELECT role FROM app.principals WHERE id = $1 FOR SHARE',
    [principalId],
  );
  if (admin && principal.rows[0]?.role !== 'admin')
    throw new ApiError(403, 'Assigned admin access required.');
  const session = await client.query(
    `SELECT token_hash FROM app.sessions WHERE token_hash = $1 AND principal_id = $2
    AND revoked_at IS NULL AND expires_at > clock_timestamp() FOR SHARE`,
    [createHash('sha256').update(token).digest('hex'), principalId],
  );
  if (!session.rowCount) throw new ApiError(401, 'Sign in again.');
}

export async function createSubmission(
  pool: Pool,
  token: string,
  profileId: string,
  value: unknown,
) {
  const ownerProfileId = parse(uuid, profileId);
  const input = parseSubmissionInput(value);
  return runPointsOperation({
    pool,
    token,
    access: 'owner',
    request: {
      profileId: ownerProfileId,
      requestId: input.requestId,
      kind: 'fan_submission',
    },
    intent: JSON.stringify([
      input.text,
      input.tag,
      input.confirmedFee,
      input.resubmissionOf,
    ]),
    outcomeSchema: submission,
    perform: async ({ client, profile, operationId }) => {
      if (input.resubmissionOf) {
        const previous = await readSubmission(client, input.resubmissionOf);
        if (previous.ownerProfileId !== profile.id)
          throw new ApiError(404, 'Submission not found.');
        if (previous.status !== 'rejected')
          throw new ApiError(
            409,
            'Only a rejected submission can be resubmitted.',
          );
      }
      const result = await client.query<{ id: string }>(
        `INSERT INTO app.fan_submissions(owner_profile_id, points_operation_id, text, tag, resubmission_of)
        VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [profile.id, operationId, input.text, input.tag, input.resubmissionOf],
      );
      const outcome = await readSubmission(client, result.rows[0].id);
      return {
        delta: -SUBMISSION_FEE,
        reason: 'Fan submission: 500 non-refundable points',
        outcome,
      };
    },
  });
}

export async function listOwnSubmissions(
  pool: Pool,
  token: string,
  profileId: string,
  query: unknown = {},
) {
  const id = parse(uuid, profileId);
  const page = parse(pageInput, query);
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    await authorize(client, actor.principalId, token, false);
    await readOwnedProfile(client, actor.principalId, id);
    const result = await client.query<Record<string, unknown>>(
      `SELECT ${columns} FROM ${source}
      WHERE s.owner_profile_id = $1 AND ($2::numeric IS NULL OR s.sequence < $2::numeric)
      ORDER BY s.sequence DESC LIMIT $3`,
      [id, page.before ?? null, page.limit + 1],
    );
    const submissions = result.rows
      .slice(0, page.limit)
      .map((row) => submission.parse(row));
    return {
      submissions,
      nextCursor:
        result.rows.length > page.limit ? submissions.at(-1)?.sequence : null,
    };
  });
}

export async function listAdminSubmissions(
  pool: Pool,
  token: string,
  query: unknown = {},
) {
  const page = parse(adminPageInput, query);
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    await authorize(client, actor.principalId, token, true);
    const result = await client.query<Record<string, unknown>>(
      `SELECT ${columns} FROM ${source}
      WHERE COALESCE(d.status, 'pending') = $1 AND ($2::numeric IS NULL OR s.sequence < $2::numeric)
      ORDER BY s.sequence DESC LIMIT $3`,
      [page.status, page.before ?? null, page.limit + 1],
    );
    const submissions = result.rows
      .slice(0, page.limit)
      .map((row) => submission.parse(row));
    return {
      submissions,
      nextCursor:
        result.rows.length > page.limit ? submissions.at(-1)?.sequence : null,
    };
  });
}

export async function moderateSubmission(
  pool: Pool,
  token: string,
  submissionId: string,
  value: unknown,
) {
  const id = parse(uuid, submissionId);
  const input = parse(decisionInput, value);
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    await authorize(client, actor.principalId, token, true);
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`submission-decision:${actor.principalId}:${input.requestId}`],
    );
    const replay = await client.query<{
      submission_id: string;
      status: string;
    }>(
      'SELECT submission_id, status FROM app.fan_submission_decisions WHERE admin_id = $1 AND request_id = $2',
      [actor.principalId, input.requestId],
    );
    if (replay.rows[0]) {
      if (
        replay.rows[0].submission_id !== id ||
        replay.rows[0].status !== input.status
      )
        throw new ApiError(
          409,
          'Request key was already used for a different decision.',
        );
      return readSubmission(client, id);
    }
    const target = await client.query(
      'SELECT id FROM app.fan_submissions WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!target.rowCount) throw new ApiError(404, 'Submission not found.');
    const previous = await readSubmission(client, id);
    if (previous.status !== 'pending')
      throw new ApiError(409, 'This submission has already been reviewed.');
    await client.query(
      'INSERT INTO app.fan_submission_decisions(submission_id, admin_id, request_id, status) VALUES ($1,$2,$3,$4)',
      [id, actor.principalId, input.requestId, input.status],
    );
    return readSubmission(client, id);
  });
}
