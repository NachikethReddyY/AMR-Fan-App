import type { Pool, PoolClient } from 'pg';
import { transaction } from '../database/index.ts';
import {
  ApiError,
  parseProfile,
  type Account,
  type Identity,
} from './types.ts';

type Connection = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;
export async function readAccount(
  db: Connection,
  principalId: string,
): Promise<Account> {
  const result = await db.query<Record<string, unknown>>(
    'SELECT id, role FROM app.principals WHERE id = $1',
    [principalId],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(401, 'Sign in again.');
  if (
    typeof row.id !== 'string' ||
    (row.role !== 'fan' && row.role !== 'admin')
  )
    throw new Error('Invalid stored principal.');
  const profiles = await db.query<Record<string, unknown>>(
    "SELECT id, kind, display_name, balance, email, birthday FROM app.profiles WHERE principal_id = $1 ORDER BY CASE kind WHEN 'real' THEN 0 ELSE 1 END",
    [principalId],
  );
  return {
    id: row.id,
    role: row.role,
    profiles: profiles.rows.map(parseProfile),
  };
}

export function ensureAccount(
  pool: Pool,
  identity: Identity,
): Promise<Account> {
  return transaction(pool, async (client) => {
    // The unique key serializes concurrent first sign-ins. Never trust email as identity.
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO app.principals(issuer, subject) VALUES ($1, $2)
       ON CONFLICT (issuer, subject) DO UPDATE SET subject = EXCLUDED.subject RETURNING id`,
      [identity.issuer, identity.subject],
    );
    const principal = inserted.rows[0];
    if (!principal) throw new Error('Principal was not persisted.');
    await client.query(
      `INSERT INTO app.profiles(principal_id, kind, display_name)
       VALUES ($1, 'real', COALESCE($2, 'Fan')), ($1, 'demo', 'Fan')
       ON CONFLICT (principal_id, kind) DO NOTHING`,
      [principal.id, identity.displayName ?? null],
    );
    if (identity.displayName)
      await client.query(
        `UPDATE app.profiles SET display_name = $2
         WHERE principal_id = $1 AND kind = 'real' AND display_name = 'Fan'`,
        [principal.id, identity.displayName],
      );
    return readAccount(client, principal.id);
  });
}

export async function readOwnedProfile(
  db: Connection,
  principalId: string,
  profileId: string,
) {
  const result = await db.query<Record<string, unknown>>(
    'SELECT id, kind, display_name, balance, email, birthday FROM app.profiles WHERE id = $1 AND principal_id = $2',
    [profileId, principalId],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, 'Profile not found.');
  return parseProfile(row);
}

/** #5 calls this inside foundation transaction(), then commits all accounting together. */
export async function lockOwnedProfile(
  client: PoolClient,
  principalId: string,
  profileId: string,
) {
  const result = await client.query<Record<string, unknown>>(
    'SELECT id, kind, display_name, balance, email, birthday FROM app.profiles WHERE id = $1 AND principal_id = $2 FOR UPDATE',
    [profileId, principalId],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, 'Profile not found.');
  return parseProfile(row);
}

export async function renameProfile(
  pool: Pool,
  principalId: string,
  profileId: string,
  displayName: string,
) {
  return transaction(pool, async (client) => {
    await lockOwnedProfile(client, principalId, profileId);
    await client.query(
      'UPDATE app.profiles SET display_name = $1 WHERE id = $2',
      [displayName, profileId],
    );
    return readOwnedProfile(client, principalId, profileId);
  });
}

export type ProfilePatch = {
  displayName?: string;
  email?: string | null;
  birthday?: string | null;
};

export async function updateProfile(
  pool: Pool,
  principalId: string,
  profileId: string,
  patch: ProfilePatch,
) {
  return transaction(pool, async (client) => {
    await lockOwnedProfile(client, principalId, profileId);
    const sets: string[] = [];
    const values: unknown[] = [];
    if (patch.displayName !== undefined) {
      values.push(patch.displayName);
      sets.push(`display_name = $${values.length}`);
    }
    if (patch.email !== undefined) {
      values.push(patch.email);
      sets.push(`email = $${values.length}`);
    }
    if (patch.birthday !== undefined) {
      values.push(patch.birthday);
      sets.push(`birthday = $${values.length}`);
    }
    if (sets.length) {
      values.push(profileId);
      await client.query(
        `UPDATE app.profiles SET ${sets.join(', ')} WHERE id = $${values.length}`,
        values,
      );
    }
    return readOwnedProfile(client, principalId, profileId);
  });
}

// Server setup only. No HTTP endpoint accepts a role assignment or its actor.
export async function assignRole(
  pool: Pool,
  principalId: string,
  role: 'fan' | 'admin',
  reason: string,
) {
  if (!reason.trim() || reason.length > 500)
    throw new Error('A bounded assignment reason is required.');
  await transaction(pool, async (client) => {
    const result = await client.query(
      'UPDATE app.principals SET role = $1 WHERE id = $2 RETURNING id',
      [role, principalId],
    );
    if (!result.rowCount)
      throw new Error('Principal not found. Sign in before assignment.');
    await client.query(
      'INSERT INTO app.role_assignments(principal_id, role, reason) VALUES ($1, $2, $3)',
      [principalId, role, reason],
    );
  });
}
