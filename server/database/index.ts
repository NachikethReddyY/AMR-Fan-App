import { Pool, type PoolClient } from 'pg';
import { databaseConfig } from './config.ts';

export function createDatabase(
  env: Parameters<typeof databaseConfig>[0] = process.env,
) {
  return new Pool(databaseConfig(env));
}

/** All statements in an operation share one connection and one atomic commit. */
export async function transaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
