import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { lockOwnedProfile } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';
import { authenticateSession } from '../auth/session.ts';
import { transaction } from '../database/index.ts';
import { runPointsOperation } from '../points/index.ts';
import { pageInput, parse, uuid } from './contracts.ts';
import {
  contributionInput,
  contributionReceipt,
  rankingQuery,
  rankingCursor,
  sharedSubmission,
  historyParticipation,
  sessionInput,
  resolutionInput,
  openSession,
  closedSession,
  interactionSession,
  selection,
  selectionSnapshot,
} from './participation-contracts.ts';

type Request = { pool: Pool; token: string };
const utc = (column: string) =>
  `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

// Same initial authority point as reviewed points/#11. Later domain waits do not redefine expiry.
async function authorize(
  client: PoolClient,
  principalId: string,
  token: string,
  admin: boolean,
) {
  const principal = await client.query<{ role: string }>(
    'SELECT role FROM app.principals WHERE id=$1 FOR SHARE',
    [principalId],
  );
  if (admin && principal.rows[0]?.role !== 'admin')
    throw new ApiError(403, 'Assigned admin access required.');
  const hash = createHash('sha256').update(token).digest('hex');
  const session = await client.query(
    `SELECT token_hash FROM app.sessions WHERE token_hash=$1 AND principal_id=$2
    AND revoked_at IS NULL AND expires_at > clock_timestamp() FOR SHARE`,
    [hash, principalId],
  );
  if (!session.rowCount) throw new ApiError(401, 'Sign in again.');
  const unexpired = await client.query(
    'SELECT 1 FROM app.sessions WHERE token_hash=$1 AND expires_at > clock_timestamp()',
    [hash],
  );
  if (!unexpired.rowCount) throw new ApiError(401, 'Sign in again.');
}
async function participationLock(client: PoolClient) {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('fan-submission-participation:v1', 0))",
  );
}
const rankJoins = `LEFT JOIN app.fan_submission_decisions d ON d.submission_id=s.id
  LEFT JOIN LATERAL (SELECT COALESCE(SUM(c.points::numeric),0) AS total
    FROM app.fan_submission_contributions c WHERE c.submission_id=s.id) votes ON true
  LEFT JOIN app.fan_submission_selections active ON active.submission_id=s.id AND active.status IN ('selected','fulfilled')`;
const publicJson = `jsonb_build_object('id',s.id,'text',s.text,'tag',s.tag,
  'approvedAt',${utc('d.decided_at')},'rankingPoints',votes.total::text,
  'status',COALESCE(active.status,'backlog'),'fulfilment','demonstration')`;

export async function contributeToSubmission({
  pool,
  token,
  profileId,
  submissionId,
  value,
}: Request & { profileId: string; submissionId: string; value: unknown }) {
  const payer = parse(uuid, profileId);
  const id = parse(uuid, submissionId);
  const input = parse(contributionInput, value);
  return runPointsOperation({
    pool,
    token,
    access: 'owner',
    request: {
      profileId: payer,
      requestId: input.requestId,
      kind: 'fan_submission_contribution',
    },
    intent: JSON.stringify([id, input.points]),
    outcomeSchema: contributionReceipt,
    perform: async ({ client, operationId }) => {
      // Profile/request locks are already held. Never invert this order in an admin operation.
      await participationLock(client);
      const target = await client.query(
        'SELECT id FROM app.fan_submissions WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!target.rowCount) throw new ApiError(404, 'Submission not found.');
      const eligible = await client.query<{ approvedAt: string }>(
        `SELECT ${utc('d.decided_at')} AS "approvedAt"
        FROM app.fan_submission_decisions d WHERE d.submission_id=$1 AND d.status='approved'
        AND NOT EXISTS (SELECT 1 FROM app.fan_submission_selections WHERE submission_id=$1 AND status IN ('selected','fulfilled'))`,
        [id],
      );
      if (!eligible.rows[0])
        throw new ApiError(409, 'Submission is not open to contributions.');
      // Future reset confirmation belongs here, after successful replay and profile locking.
      await client.query(
        'INSERT INTO app.fan_submission_contributions(points_operation_id,submission_id,points) VALUES ($1,$2,$3)',
        [operationId, id, input.points],
      );
      const total = await client.query<{ total: string }>(
        'SELECT SUM(points::numeric)::text AS total FROM app.fan_submission_contributions WHERE submission_id=$1',
        [id],
      );
      return {
        delta: -input.points,
        reason: 'Fan submission contribution',
        outcome: {
          pointsOperationId: operationId,
          submissionId: id,
          points: input.points,
          rankingPointsAfter: total.rows[0].total,
          approvedAt: eligible.rows[0].approvedAt,
        },
      };
    },
  });
}

export async function readSharedSubmissions({
  pool,
  token,
  query = {},
}: Request & { query?: unknown }) {
  const page = parse(rankingQuery, query);
  let after: z.infer<typeof rankingCursor> | undefined;
  if (page.after) {
    try {
      after = parse(
        rankingCursor,
        JSON.parse(Buffer.from(page.after, 'base64url').toString('utf8')),
      );
    } catch {
      throw new ApiError(400, 'Invalid ranking cursor.');
    }
  }
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    await authorize(client, actor.principalId, token, false);
    const rows = await client.query<Record<string, unknown>>(
      `SELECT ${publicJson} AS item, s.sequence::text AS sequence
      FROM app.fan_submissions s ${rankJoins} WHERE d.status='approved' AND
      ($1::numeric IS NULL OR votes.total < $1 OR (votes.total=$1 AND
        (d.decided_at > $2::timestamptz OR (d.decided_at=$2::timestamptz AND s.sequence > $3::numeric))))
      ORDER BY votes.total DESC,d.decided_at ASC,s.sequence ASC LIMIT $4`,
      [
        after?.points ?? null,
        after?.approvedAt ?? null,
        after?.sequence ?? null,
        page.limit + 1,
      ],
    );
    const visible = rows.rows.slice(0, page.limit).map((row) => ({
      item: sharedSubmission.parse(row.item),
      sequence: rankingCursor.shape.sequence.parse(row.sequence),
    }));
    const last = visible.at(-1);
    return {
      items: visible.map((row) => row.item),
      nextCursor:
        rows.rows.length > page.limit && last
          ? Buffer.from(
              JSON.stringify({
                points: last.item.rankingPoints,
                approvedAt: last.item.approvedAt,
                sequence: last.sequence,
              }),
            ).toString('base64url')
          : null,
    };
  });
}

export async function readOwnSubmissionParticipation({
  pool,
  token,
  profileId,
  query = {},
}: Request & { profileId: string; query?: unknown }) {
  const id = parse(uuid, profileId);
  const page = parse(pageInput, query);
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    await authorize(client, actor.principalId, token, false);
    await lockOwnedProfile(client, actor.principalId, id);
    const result = await client.query<Record<string, unknown>>(
      `SELECT o.id AS "pointsOperationId",o.sequence::text,
      s.id AS "submissionId",COALESCE(d.status,'pending') AS moderation,
      CASE WHEN d.status='approved' THEN ${publicJson} ELSE NULL END AS participation
      FROM app.points_operations o JOIN (
        SELECT points_operation_id,id AS submission_id FROM app.fan_submissions
        UNION ALL SELECT points_operation_id,submission_id FROM app.fan_submission_contributions
      ) links ON links.points_operation_id=o.id JOIN app.fan_submissions s ON s.id=links.submission_id
      ${rankJoins} WHERE o.profile_id=$1 AND ($2::numeric IS NULL OR o.sequence < $2::numeric)
      ORDER BY o.sequence DESC LIMIT $3`,
      [id, page.before ?? null, page.limit + 1],
    );
    const items = result.rows
      .slice(0, page.limit)
      .map((row) => historyParticipation.parse(row));
    return {
      items,
      nextCursor:
        result.rows.length > page.limit ? items.at(-1)?.sequence : null,
    };
  });
}

async function adminAction<T>({
  pool,
  token,
  requestId,
  kind,
  intent,
  schema,
  perform,
}: Request & {
  requestId: string;
  kind: 'create' | 'close' | 'release' | 'fulfil';
  intent: string;
  schema: z.ZodType<T>;
  perform: (
    client: PoolClient,
    actorId: string,
    actionId: string,
  ) => Promise<T>;
}) {
  const actor = await authenticateSession(pool, token);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([kind, intent]))
    .digest('hex');
  return transaction(pool, async (client) => {
    await authorize(client, actor.principalId, token, true);
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `submission-participation:${actor.principalId}:${requestId}`,
    ]);
    const previous = await client.query<{
      fingerprint: string;
      outcome: unknown;
    }>(
      'SELECT fingerprint,outcome FROM app.fan_submission_admin_actions WHERE actor_id=$1 AND request_id=$2',
      [actor.principalId, requestId],
    );
    if (previous.rows[0]) {
      if (previous.rows[0].fingerprint !== fingerprint)
        throw new ApiError(
          409,
          'Request key was already used for a different action.',
        );
      return schema.parse(previous.rows[0].outcome);
    }
    await participationLock(client);
    const actionId = randomUUID();
    const outcome = schema.parse(
      await perform(client, actor.principalId, actionId),
    );
    await client.query(
      'INSERT INTO app.fan_submission_admin_actions(id,actor_id,request_id,kind,fingerprint,outcome) VALUES ($1,$2,$3,$4,$5,$6)',
      [
        actionId,
        actor.principalId,
        requestId,
        kind,
        fingerprint,
        JSON.stringify(outcome),
      ],
    );
    return outcome;
  });
}
const sessionColumns = `id,sequence::text,created_by AS "createdBy",${utc('created_at')} AS "createdAt"`;
const snapshotColumns = `id,session_id AS "sessionId",submission_id AS "submissionId",rank,
  ranking_points::text AS "rankingPointsAtClose",${utc('approved_at')} AS "approvedAt",${utc('selected_at')} AS "selectedAt"`;
async function currentSelections(client: PoolClient, sessionId: string) {
  const result = await client.query<Record<string, unknown>>(
    `SELECT ${snapshotColumns},status,
    resolved_by AS "resolvedBy",${utc('resolved_at')} AS "resolvedAt",reason FROM app.fan_submission_selections WHERE session_id=$1 ORDER BY rank`,
    [sessionId],
  );
  return result.rows.map((row) => {
    if (row.status === 'selected') {
      const {
        resolvedBy: _by,
        resolvedAt: _at,
        reason: _reason,
        ...pending
      } = row;
      return selection.parse(pending);
    }
    return selection.parse({ ...row, fulfilment: 'demonstration' });
  });
}
export async function createInteractionSession({
  pool,
  token,
  value,
}: Request & { value: unknown }) {
  const input = parse(sessionInput, value);
  return adminAction({
    pool,
    token,
    requestId: input.requestId,
    kind: 'create',
    intent: '[]',
    schema: openSession,
    perform: async (client, actorId, actionId) => {
      const result = await client.query(
        `INSERT INTO app.fan_interaction_sessions(created_by,created_action_id) VALUES ($1,$2) RETURNING ${sessionColumns}`,
        [actorId, actionId],
      );
      return openSession.parse({ ...result.rows[0], state: 'open' });
    },
  });
}
export async function closeInteractionSession({
  pool,
  token,
  sessionId,
  value,
}: Request & { sessionId: string; value: unknown }) {
  const id = parse(uuid, sessionId);
  const input = parse(sessionInput, value);
  return adminAction({
    pool,
    token,
    requestId: input.requestId,
    kind: 'close',
    intent: JSON.stringify([id]),
    schema: closedSession,
    perform: async (client, actorId, actionId) => {
      const result = await client.query(
        `SELECT ${sessionColumns},closed_action_id FROM app.fan_interaction_sessions WHERE id=$1 FOR UPDATE`,
        [id],
      );
      const row = result.rows[0];
      if (!row) throw new ApiError(404, 'Session not found.');
      if (row.closed_action_id) {
        const original = await client.query(
          'SELECT outcome FROM app.fan_submission_admin_actions WHERE id=$1',
          [row.closed_action_id],
        );
        return closedSession.parse(original.rows[0].outcome);
      }
      const candidates =
        await client.query(`SELECT s.id,votes.total::text AS total,${utc('d.decided_at')} AS "approvedAt"
        FROM app.fan_submissions s ${rankJoins} WHERE d.status='approved' AND active.id IS NULL AND votes.total>0
        ORDER BY votes.total DESC,d.decided_at ASC,s.sequence ASC LIMIT 3`);
      const parsed = candidates.rows.map((row) =>
        z
          .strictObject({
            id: uuid,
            total: rankingCursor.shape.points,
            approvedAt: z.iso.datetime(),
          })
          .parse(row),
      );
      // The global participation lock holds the ranking stable; row locks follow UUID order.
      await client.query(
        'SELECT id FROM app.fan_submissions WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [parsed.map((row) => row.id)],
      );
      const selections = [];
      for (const [index, candidate] of parsed.entries()) {
        const inserted = await client.query(
          `INSERT INTO app.fan_submission_selections(session_id,submission_id,rank,ranking_points,approved_at)
          VALUES ($1,$2,$3,$4,$5) RETURNING ${snapshotColumns}`,
          [id, candidate.id, index + 1, candidate.total, candidate.approvedAt],
        );
        selections.push(selectionSnapshot.parse(inserted.rows[0]));
      }
      const closed = await client.query(
        `UPDATE app.fan_interaction_sessions SET closed_by=$2,closed_at=clock_timestamp(),closed_action_id=$3
        WHERE id=$1 RETURNING ${sessionColumns},closed_by AS "closedBy",${utc('closed_at')} AS "closedAt"`,
        [id, actorId, actionId],
      );
      return closedSession.parse({
        ...closed.rows[0],
        state: 'closed',
        selections,
      });
    },
  });
}
export async function resolveSubmissionSelection({
  pool,
  token,
  selectionId,
  value,
}: Request & { selectionId: string; value: unknown }) {
  const id = parse(uuid, selectionId);
  const input = parse(resolutionInput, value);
  return adminAction({
    pool,
    token,
    requestId: input.requestId,
    kind: input.action,
    intent: JSON.stringify([id, input.reason]),
    schema: selection,
    perform: async (client, actorId, actionId) => {
      const target = await client.query<{
        session_id: string;
        submission_id: string;
      }>(
        'SELECT session_id,submission_id FROM app.fan_submission_selections WHERE id=$1',
        [id],
      );
      const row = target.rows[0];
      if (!row) throw new ApiError(404, 'Selection not found.');
      await client.query(
        'SELECT id FROM app.fan_interaction_sessions WHERE id=$1 FOR UPDATE',
        [row.session_id],
      );
      await client.query(
        'SELECT id FROM app.fan_submissions WHERE id=$1 FOR UPDATE',
        [row.submission_id],
      );
      const changed = await client.query(
        `UPDATE app.fan_submission_selections SET status=$2,resolved_by=$3,resolved_at=clock_timestamp(),reason=$4,resolved_action_id=$5
        WHERE id=$1 AND status='selected' RETURNING id`,
        [
          id,
          input.action === 'release' ? 'released' : 'fulfilled',
          actorId,
          input.reason,
          actionId,
        ],
      );
      if (!changed.rowCount)
        throw new ApiError(409, 'Selection is already resolved.');
      const resolved = (await currentSelections(client, row.session_id)).find(
        (s) => s.id === id,
      );
      return selection.parse(resolved);
    },
  });
}
export async function listInteractionSessions({
  pool,
  token,
  query = {},
}: Request & { query?: unknown }) {
  const page = parse(pageInput, query);
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    await authorize(client, actor.principalId, token, true);
    // One statement snapshots session, original close receipt and current resolution together.
    const result = await client.query(
      `SELECT s.sequence::text, CASE WHEN s.closed_action_id IS NULL THEN
      jsonb_build_object('id',s.id,'sequence',s.sequence::text,'createdBy',s.created_by,'createdAt',${utc('s.created_at')},'state','open')
      ELSE a.outcome END AS session,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'sessionId',x.session_id,'submissionId',x.submission_id,
        'rank',x.rank,'rankingPointsAtClose',x.ranking_points::text,'approvedAt',${utc('x.approved_at')},'selectedAt',${utc('x.selected_at')},'status',x.status)
        || CASE WHEN x.status='selected' THEN '{}'::jsonb ELSE jsonb_build_object('resolvedBy',x.resolved_by,'resolvedAt',${utc('x.resolved_at')},'reason',x.reason,'fulfilment','demonstration') END ORDER BY x.rank)
        FROM app.fan_submission_selections x WHERE x.session_id=s.id),'[]'::jsonb) AS selections,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.id,'text',f.text,'tag',f.tag) ORDER BY x.rank)
        FROM app.fan_submission_selections x JOIN app.fan_submissions f ON f.id=x.submission_id
        WHERE x.session_id=s.id),'[]'::jsonb) AS content
      FROM app.fan_interaction_sessions s LEFT JOIN app.fan_submission_admin_actions a ON a.id=s.closed_action_id
      WHERE ($1::numeric IS NULL OR s.sequence < $1::numeric) ORDER BY s.sequence DESC LIMIT $2`,
      [page.before ?? null, page.limit + 1],
    );
    const items = result.rows.slice(0, page.limit).map((row) => ({
      session: interactionSession.parse(row.session),
      selections: z.array(selection).max(3).parse(row.selections),
      content: z
        .array(sharedSubmission.pick({ id: true, text: true, tag: true }))
        .max(3)
        .parse(row.content),
    }));
    return {
      items,
      nextCursor:
        result.rows.length > page.limit ? items.at(-1)?.session.sequence : null,
    };
  });
}
