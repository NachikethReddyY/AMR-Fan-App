import type { Pool } from 'pg';
import { transaction } from '../database/index.ts';

export type GoogleRouteBudget = {
  reserve: (attempts: number) => Promise<boolean>;
};

// One lifetime allowance shared by every API process using this database.
// A lost COMMIT acknowledgement is never retried or refunded.
export function createGoogleRouteBudget(pool: Pool): GoogleRouteBudget {
  return {
    async reserve(attempts) {
      if (!Number.isInteger(attempts) || attempts < 1 || attempts > 4)
        throw new Error('Invalid Google route reservation.');
      return transaction(pool, async (client) => {
        await client.query('SET LOCAL synchronous_commit = on');
        await client.query("SET LOCAL lock_timeout = '1000ms'");
        await client.query("SET LOCAL statement_timeout = '1000ms'");
        const result = await client.query(
          `UPDATE app.google_route_budget
           SET used_attempts = used_attempts + $1
           WHERE singleton = true AND used_attempts + $1 <= 200
           RETURNING used_attempts`,
          [attempts],
        );
        return result.rowCount === 1;
      });
    },
  };
}
