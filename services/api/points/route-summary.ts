import type { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { readOwnedProfile } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';
import { authenticateSession } from '../auth/session.ts';
import { transaction } from '../database/index.ts';

export async function readRouteSummary(
  pool: Pool,
  token: string,
  profileId: string,
) {
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    const profile = await readOwnedProfile(client, actor.principalId, profileId);
    const session = await client.query(
      `SELECT 1 FROM app.sessions
       WHERE token_hash=$1 AND principal_id=$2 AND revoked_at IS NULL
       AND expires_at > clock_timestamp()`,
      [createHash('sha256').update(token).digest('hex'), actor.principalId],
    );
    if (!session.rowCount) throw new ApiError(401, 'Sign in again.');
    const result = await client.query<{
      distance_meters: string | number;
      saved_kg: string | number;
      route_count: string | number;
    }>(
      `SELECT
         COALESCE(SUM(CASE
           WHEN jsonb_typeof(outcome->'distanceMeters') = 'number'
           THEN (outcome->>'distanceMeters')::numeric
           ELSE 0
         END), 0) AS distance_meters,
         COALESCE(SUM(CASE
           WHEN jsonb_typeof(outcome->'savedKg') = 'number'
           THEN (outcome->>'savedKg')::numeric
           ELSE 0
         END), 0) AS saved_kg,
         COUNT(*) FILTER (WHERE kind='route_completion')::int AS route_count
       FROM app.points_operations
       WHERE profile_id=$1 AND kind='route_completion'`,
      [profile.id],
    );
    const row = result.rows[0];
    return {
      distanceMeters: Number(row?.distance_meters ?? 0),
      savedKg: Number(row?.saved_kg ?? 0),
      routeCount: Number(row?.route_count ?? 0),
    };
  });
}
