import { createHash, randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { ApiError } from '../accounts/types.ts';

const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export async function createSession(pool: Pool, principalId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  await pool.query(
    'INSERT INTO app.sessions(token_hash, principal_id, expires_at) VALUES ($1, $2, $3)',
    [digest(token), principalId, expiresAt],
  );
  return { token, expiresAt };
}
export async function authenticateSession(pool: Pool, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new ApiError(401, 'Sign in again.');
  const result = await pool.query<{ principal_id: string; role: string }>(
    `SELECT s.principal_id, p.role FROM app.sessions s JOIN app.principals p ON p.id = s.principal_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [digest(token)],
  );
  const row = result.rows[0];
  if (!row || (row.role !== 'fan' && row.role !== 'admin'))
    throw new ApiError(401, 'Sign in again.');
  return { principalId: row.principal_id, role: row.role };
}
export async function revokeSession(pool: Pool, token: string) {
  await pool.query(
    'UPDATE app.sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE token_hash = $1',
    [digest(token)],
  );
}
