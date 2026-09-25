import type { Pool } from 'pg';
import { transaction } from './index.ts';

/** Synthetic infrastructure data only. Never grants app identities or points. */
export async function seedLocal(
  pool: Pool,
  env: { NODE_ENV?: string } = process.env,
) {
  if (!['development', 'test'].includes(env.NODE_ENV ?? '')) {
    throw new Error(
      'Synthetic seed requires explicit development or test mode.',
    );
  }
  return transaction(pool, async (client) => {
    const result = await client.query<{ current_database: string }>(
      'SELECT current_database()',
    );
    if (
      !/^amr_[a-f0-9]{12}_(dev|test)$/.test(
        result.rows[0]?.current_database ?? '',
      )
    ) {
      throw new Error(
        'Synthetic seed is restricted to a disposable local namespace.',
      );
    }
    await client.query('CREATE SCHEMA IF NOT EXISTS local_fixture');
    await client.query(`CREATE TABLE IF NOT EXISTS local_fixture.probes (
      name text PRIMARY KEY, value integer NOT NULL, description text NOT NULL
    )`);
    await client.query(
      `INSERT INTO local_fixture.probes VALUES ('synthetic', 1, 'Synthetic infrastructure fixture; no product data') ON CONFLICT (name) DO NOTHING`,
    );
  });
}
