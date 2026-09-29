import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { lockOwnedProfile } from '../accounts/store.ts';
import { ApiError, parseProfile, type Profile } from '../accounts/types.ts';
import { authenticateSession } from '../auth/session.ts';
import { transaction } from '../database/index.ts';
import {
  adjustmentInput,
  historyEntry,
  historyQuery,
  operationRequest,
  parseInput,
  points,
  pointsDelta,
  profileIdInput,
  reason,
  type HistoryEntry,
} from './contracts.ts';

type Actor = Awaited<ReturnType<typeof authenticateSession>>;
type Access = 'owner' | 'admin';

// Hold current authority for the transaction, including concurrent role/logout changes.
async function authorize(
  client: PoolClient,
  actor: Actor,
  token: string,
  access: Access,
) {
  const principal = await client.query<{ role: string }>(
    'SELECT role FROM app.principals WHERE id = $1 FOR SHARE',
    [actor.principalId],
  );
  if (access === 'admin' && principal.rows[0]?.role !== 'admin')
    throw new ApiError(403, 'Assigned admin access required.');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const session = await client.query(
    `SELECT token_hash FROM app.sessions WHERE token_hash = $1 AND principal_id = $2
     AND revoked_at IS NULL AND expires_at > clock_timestamp() FOR SHARE`,
    [tokenHash, actor.principalId],
  );
  if (!session.rowCount) throw new ApiError(401, 'Sign in again.');
  // The locking SELECT can evaluate expiry before waiting on an unchanged row.
  // Recheck the database clock after the session authority lock is held.
  const unexpired = await client.query(
    'SELECT 1 FROM app.sessions WHERE token_hash = $1 AND expires_at > clock_timestamp()',
    [tokenHash],
  );
  if (!unexpired.rowCount) throw new ApiError(401, 'Sign in again.');
}
async function lockProfile(
  client: PoolClient,
  actor: Actor,
  profileId: string,
  access: Access,
) {
  if (access === 'owner')
    return lockOwnedProfile(client, actor.principalId, profileId);
  const result = await client.query<Record<string, unknown>>(
    'SELECT id, kind, display_name, balance FROM app.profiles WHERE id = $1 FOR UPDATE',
    [profileId],
  );
  if (!result.rows[0]) throw new ApiError(404, 'Profile not found.');
  return parseProfile(result.rows[0]);
}
const entryColumns = `id, sequence::text, profile_id AS "profileId", actor_id AS "actorId",
  kind, delta, balance_after AS "balanceAfter", reason,
  to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "recordedAt"`;

/** Server-only composition point. Callers supply typed policy, never client credit authority.
 * All domain writes must use this client and throw on failure; no nested commit or external I/O.
 * Successful replay runs before perform(), where future price/epoch/eligibility checks belong.
 */
export async function runPointsOperation<T>({
  pool,
  token,
  request,
  access,
  intent,
  outcomeSchema,
  perform,
}: {
  pool: Pool;
  token: string;
  request: z.infer<typeof operationRequest>;
  access: Access;
  intent: string;
  outcomeSchema: z.ZodType<T>;
  perform: (context: {
    client: PoolClient;
    profile: Profile;
    actor: Actor;
    operationId: string;
  }) => Promise<{
    delta: number;
    reason: string;
    outcome: T;
  }>;
}): Promise<{ entry: HistoryEntry; outcome: T }> {
  const parsed = parseInput(operationRequest, request);
  const actor = await authenticateSession(pool, token);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([parsed.profileId, parsed.kind, intent]))
    .digest('hex');
  return transaction(pool, async (client) => {
    await authorize(client, actor, token, access);
    // Serialize a key even when concurrent requests name different profiles.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`${actor.principalId}:${parsed.requestId}`],
    );
    const profile = await lockProfile(client, actor, parsed.profileId, access);
    const previous = await client.query<Record<string, unknown>>(
      `SELECT ${entryColumns}, fingerprint, outcome FROM app.points_operations WHERE actor_id = $1 AND request_id = $2`,
      [actor.principalId, parsed.requestId],
    );
    const stored = previous.rows[0];
    if (stored) {
      if (stored.fingerprint !== fingerprint)
        throw new ApiError(
          409,
          'Request key was already used for a different action.',
        );
      const { fingerprint: _fingerprint, outcome, ...entry } = stored;
      return {
        entry: historyEntry.parse(entry),
        outcome: outcomeSchema.parse(outcome),
      };
    }
    const operationId = randomUUID();
    const effect = await perform({ client, profile, actor, operationId });
    const delta = pointsDelta.parse(effect.delta);
    const explanation = reason.parse(effect.reason);
    const balanceAfter = profile.balance + delta;
    if (balanceAfter < 0) throw new ApiError(409, 'Insufficient points.');
    if (!points.safeParse(balanceAfter).success)
      throw new ApiError(409, 'Points balance limit exceeded.');
    const outcome = outcomeSchema.parse(effect.outcome);
    await client.query('UPDATE app.profiles SET balance = $1 WHERE id = $2', [
      balanceAfter,
      profile.id,
    ]);
    const saved = await client.query<Record<string, unknown>>(
      `INSERT INTO app.points_operations(id, actor_id, profile_id, request_id, kind, fingerprint,
         delta, balance_before, balance_after, reason, outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${entryColumns}`,
      [
        operationId,
        actor.principalId,
        profile.id,
        parsed.requestId,
        parsed.kind,
        fingerprint,
        delta,
        profile.balance,
        balanceAfter,
        explanation,
        JSON.stringify(outcome),
      ],
    );
    return { entry: historyEntry.parse(saved.rows[0]), outcome };
  });
}

export async function adjustPoints(pool: Pool, token: string, value: unknown) {
  const input = parseInput(adjustmentInput, value);
  const result = await runPointsOperation({
    pool,
    token,
    access: 'admin',
    request: {
      profileId: input.targetProfileId,
      requestId: input.requestId,
      kind: 'admin_adjustment',
    },
    intent: JSON.stringify([input.delta, input.reason]),
    outcomeSchema: z.null(),
    perform: async () => ({
      delta: input.delta,
      reason: input.reason,
      outcome: null,
    }),
  });
  return result.entry;
}

export async function listAdminProfiles(
  pool: Pool,
  token: string,
  query: unknown,
) {
  const page = parseInput(
    z.strictObject({ after: profileIdInput.optional() }),
    query,
  );
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    await authorize(client, actor, token, 'admin');
    const result = await client.query<Record<string, unknown>>(
      `SELECT id, kind, display_name, balance FROM app.profiles
       WHERE ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT 51`,
      [page.after ?? null],
    );
    const profiles = result.rows.slice(0, 50).map(parseProfile);
    return {
      profiles,
      nextCursor: result.rows.length > 50 ? profiles.at(-1)?.id : null,
    };
  });
}

export async function readPointsHistory(
  pool: Pool,
  token: string,
  profileId: string,
  query: unknown = {},
  access: Access = 'owner',
) {
  const id = parseInput(profileIdInput, profileId);
  const page = parseInput(historyQuery, query);
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    await authorize(client, actor, token, access);
    // A profile lock keeps the balance and page consistent with one committed state.
    const profile = await lockProfile(client, actor, id, access);
    const result = await client.query<Record<string, unknown>>(
      `SELECT ${entryColumns} FROM app.points_operations
       WHERE profile_id = $1 AND ($2::numeric IS NULL OR sequence < $2::numeric)
       ORDER BY points_operations.sequence DESC LIMIT $3`,
      [id, page.before ?? null, page.limit + 1],
    );
    const entries = result.rows
      .slice(0, page.limit)
      .map((row) => historyEntry.parse(row));
    return {
      profile,
      balance: profile.balance,
      entries,
      nextCursor:
        result.rows.length > page.limit ? entries.at(-1)?.sequence : null,
    };
  });
}
