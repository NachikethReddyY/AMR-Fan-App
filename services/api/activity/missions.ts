import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { authenticateSession } from '../auth/session.ts';
import { ApiError } from '../accounts/types.ts';
import { lockOwnedProfile } from '../accounts/store.ts';
import { transaction } from '../database/index.ts';
import {
  missionEnrollmentResponse,
  missionsResponse,
  type MissionCategory,
  type MissionListEntry,
} from './reward-contract.ts';

const uuid = z.uuid().transform((value) => value.toLowerCase());
const missionIdInput = z.strictObject({ profileId: uuid });
type MissionRow = {
  id: string;
  slug: string;
  title: string;
  category: MissionCategory;
  source_label: string;
  kind: 'personal' | 'race_week';
  target: number;
  community_target: number | null;
  policy_version: string;
  starts_at: Date | string;
  ends_at: Date | string;
  timezone: string;
  status: 'active' | 'archived';
  version: number;
};
type MissionDefinition = Pick<
  MissionRow,
  | 'id'
  | 'category'
  | 'target'
  | 'starts_at'
  | 'ends_at'
  | 'status'
  | 'version'
  | 'policy_version'
>;
function availability(
  row: { status: string; starts_at: Date | string; ends_at: Date | string },
  now: Date,
) {
  const starts = new Date(row.starts_at);
  const ends = new Date(row.ends_at);
  if (row.status !== 'active') return 'unavailable' as const;
  if (now < starts) return 'upcoming' as const;
  if (now >= ends) return 'expired' as const;
  return 'active' as const;
}
async function authorizeMissionTransaction(
  client: PoolClient,
  principalId: string,
  token: string,
) {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const session = await client.query(
    `SELECT token_hash FROM app.sessions
     WHERE token_hash=$1 AND principal_id=$2 AND revoked_at IS NULL AND expires_at > clock_timestamp()
     FOR SHARE`,
    [tokenHash, principalId],
  );
  if (!session.rowCount) throw new ApiError(401, 'Sign in again.');
  const fresh = await client.query(
    'SELECT 1 FROM app.sessions WHERE token_hash=$1 AND expires_at > clock_timestamp() AND revoked_at IS NULL',
    [tokenHash],
  );
  if (!fresh.rowCount) throw new ApiError(401, 'Sign in again.');
}

export async function listMissions(
  pool: Pool,
  token: string,
  value: unknown,
  now = new Date(),
) {
  const { profileId } = missionIdInput.parse(value);
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    await authorizeMissionTransaction(client, actor.principalId, token);
    const profile = await lockOwnedProfile(
      client,
      actor.principalId,
      profileId,
    );
    // Profile locking can wait behind another transaction. Recheck session
    // authority after that wait before reading mission state.
    await authorizeMissionTransaction(client, actor.principalId, token);
    const clock = await client.query<{ now: Date }>(
      'SELECT clock_timestamp() AS now',
    );
    const databaseNow = clock.rows[0]?.now ?? new Date();
    const effectiveNow = new Date(
      Math.max(now.getTime(), databaseNow.getTime()),
    );
    const definitions = await client.query<MissionRow>(
      `SELECT id, slug, title, category, source_label, kind, target, community_target,
              policy_version, starts_at, ends_at, timezone, status, version
       FROM app.mission_definitions ORDER BY slug LIMIT 20`,
    );
    // Definition reads use row/share locks and may also wait. Keep the
    // response owner-scoped when a session is revoked during that wait.
    await authorizeMissionTransaction(client, actor.principalId, token);
    const rows: MissionListEntry[] = [];
    for (const row of definitions.rows) {
      const progress = await client.query<{ count: number }>(
        'SELECT count FROM app.mission_progress WHERE profile_id=$1 AND mission_id=$2',
        [profile.id, row.id],
      );
      const count = Number(progress.rows[0]?.count ?? 0);
      const progressState = !progress.rows[0]
        ? { kind: 'not_enrolled' as const, count: 0 as const }
        : count >= row.target
          ? { kind: 'completed' as const, count }
          : { kind: 'enrolled' as const, count };
      const community = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM app.mission_events
         WHERE mission_id=$1 AND source_context='production'`,
        [row.id],
      );
      rows.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        category: row.category,
        kind: row.kind,
        target: row.target,
        communityTarget: row.community_target,
        policyVersion: row.policy_version,
        startsAt: new Date(row.starts_at).toISOString(),
        endsAt: new Date(row.ends_at).toISOString(),
        timezone: row.timezone,
        status: row.status,
        version: row.version,
        availability:
          profile.kind === 'real'
            ? availability(row, effectiveNow)
            : 'unavailable',
        progress: progressState,
        communityProgress: Number(community.rows[0]?.count ?? 0),
        attribution: { sourceLabel: row.source_label },
      });
    }
    const categoryCounts = await client.query<{
      category: string;
      count: number;
    }>(
      `SELECT a.result->>'category' AS category, count(*)::int AS count
       FROM app.activity_reward_claims c JOIN app.activity_assessments a ON a.id=c.assessment_id
       WHERE c.profile_id=$1 AND c.source_context='production'
       GROUP BY a.result->>'category'`,
      [profile.id],
    );
    const counts = new Map(
      categoryCounts.rows.map((entry) => [entry.category, Number(entry.count)]),
    );
    const recommended =
      rows
        .filter(
          (row) =>
            row.availability === 'active' && row.progress.kind !== 'completed',
        )
        .sort(
          (a, b) =>
            (counts.get(a.category) ?? 0) - (counts.get(b.category) ?? 0) ||
            a.slug.localeCompare(b.slug),
        )[0]?.id ?? null;
    if (profile.kind !== 'real')
      await authorizeMissionTransaction(client, actor.principalId, token);
    if (profile.kind !== 'real')
      return missionsResponse.parse({
        kind: 'unavailable' as const,
        reason: 'demo_profile' as const,
        missions: [],
        recommendedMissionId: null,
      });
    await authorizeMissionTransaction(client, actor.principalId, token);
    return missionsResponse.parse({
      kind: 'available' as const,
      missions: rows,
      recommendedMissionId: recommended,
    });
  });
}

export async function enrollMission(
  pool: Pool,
  token: string,
  missionIdValue: string,
  value: unknown,
  now = new Date(),
) {
  const missionId = uuid.parse(missionIdValue);
  const { profileId } = missionIdInput.parse(value);
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    await authorizeMissionTransaction(client, actor.principalId, token);
    const profile = await lockOwnedProfile(
      client,
      actor.principalId,
      profileId,
    );
    await authorizeMissionTransaction(client, actor.principalId, token);
    if (profile.kind !== 'real')
      throw new ApiError(409, 'Mission enrollment requires a real profile.');
    const result = await client.query<MissionRow>(
      'SELECT id, slug, title, category, source_label, kind, target, community_target, policy_version, starts_at, ends_at, timezone, status, version FROM app.mission_definitions WHERE id=$1 FOR SHARE',
      [missionId],
    );
    const row = result.rows[0];
    if (!row) throw new ApiError(404, 'Mission not found.');
    await authorizeMissionTransaction(client, actor.principalId, token);
    const clock = await client.query<{ now: Date }>(
      'SELECT clock_timestamp() AS now',
    );
    const databaseNow = clock.rows[0]?.now ?? new Date();
    const state = availability(
      row,
      new Date(Math.max(now.getTime(), databaseNow.getTime())),
    );
    if (state !== 'active') throw new ApiError(409, `Mission is ${state}.`);
    const existing = await client.query<{ version: number }>(
      'SELECT version FROM app.mission_enrollments WHERE profile_id=$1 AND mission_id=$2 FOR SHARE',
      [profile.id, missionId],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].version !== row.version)
        throw new ApiError(
          409,
          'Mission version changed. Read missions again.',
        );
      await authorizeMissionTransaction(client, actor.principalId, token);
      return missionEnrollmentResponse.parse({
        kind: 'already_enrolled' as const,
        missionId,
        version: existing.rows[0].version,
      });
    }
    await authorizeMissionTransaction(client, actor.principalId, token);
    await client.query(
      'INSERT INTO app.mission_enrollments(profile_id, mission_id, version) VALUES ($1,$2,$3)',
      [profile.id, missionId, row.version],
    );
    await client.query(
      'INSERT INTO app.mission_progress(profile_id, mission_id, count) VALUES ($1,$2,0)',
      [profile.id, missionId],
    );
    await authorizeMissionTransaction(client, actor.principalId, token);
    return missionEnrollmentResponse.parse({
      kind: 'enrolled' as const,
      missionId,
      version: row.version,
    });
  });
}

export type MissionEligibility =
  | { kind: 'none' }
  | { kind: 'eligible'; definition: MissionDefinition; count: number }
  | {
      kind: 'ineligible';
      reason:
        | 'mission_ineligible'
        | 'not_enrolled'
        | 'expired'
        | 'upcoming'
        | 'archived'
        | 'category_mismatch'
        | 'version_mismatch'
        | 'completed'
        | 'duplicate_event';
    };

export async function checkMissionEligibility(
  client: PoolClient,
  profileId: string,
  missionId: string | null,
  category: string,
  now = new Date(),
): Promise<MissionEligibility> {
  if (!missionId) return { kind: 'none' };
  const result = await client.query<MissionDefinition>(
    `SELECT id, category, target, starts_at, ends_at, status, version, policy_version
     FROM app.mission_definitions WHERE id=$1 FOR SHARE`,
    [missionId],
  );
  const definition = result.rows[0];
  if (!definition) return { kind: 'ineligible', reason: 'mission_ineligible' };
  const clock = await client.query<{ now: Date }>(
    'SELECT clock_timestamp() AS now',
  );
  const databaseNow = clock.rows[0]?.now ?? new Date();
  const effectiveNow = new Date(Math.max(now.getTime(), databaseNow.getTime()));
  if (definition.status !== 'active')
    return { kind: 'ineligible', reason: 'archived' };
  if (effectiveNow < new Date(definition.starts_at))
    return { kind: 'ineligible', reason: 'upcoming' };
  if (effectiveNow >= new Date(definition.ends_at))
    return { kind: 'ineligible', reason: 'expired' };
  const enrollment = await client.query<{ version: number }>(
    'SELECT version FROM app.mission_enrollments WHERE profile_id=$1 AND mission_id=$2 FOR SHARE',
    [profileId, missionId],
  );
  if (!enrollment.rows[0])
    return { kind: 'ineligible', reason: 'not_enrolled' };
  if (enrollment.rows[0].version !== definition.version)
    return { kind: 'ineligible', reason: 'version_mismatch' };
  if (definition.policy_version !== 'activity-reward-v1')
    return { kind: 'ineligible', reason: 'version_mismatch' };
  if (definition.category !== category)
    return { kind: 'ineligible', reason: 'category_mismatch' };
  const progress = await client.query<{ count: number }>(
    'SELECT count FROM app.mission_progress WHERE profile_id=$1 AND mission_id=$2 FOR UPDATE',
    [profileId, missionId],
  );
  const count = Number(progress.rows[0]?.count ?? 0);
  if (count >= definition.target)
    return { kind: 'ineligible', reason: 'completed' };
  return { kind: 'eligible', definition, count };
}
