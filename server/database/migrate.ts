import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { transaction } from './index.ts';

const migrations = new URL('./migrations/', import.meta.url);

export async function migrate(pool: Pool) {
  const files = (await readdir(migrations))
    .filter((file) => /^\d{4}_[a-z_]+\.sql$/.test(file))
    .sort();
  return transaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(48136291)');
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const history = await client.query<{ name: string }>(
      'SELECT name FROM public.schema_migrations',
    );
    if (history.rows.some((row) => !files.includes(row.name))) {
      throw new Error(
        'Database contains an applied migration absent from this checkout.',
      );
    }
    for (const name of files) {
      const sql = await readFile(new URL(name, migrations), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = await client.query<{ checksum: string }>(
        'SELECT checksum FROM public.schema_migrations WHERE name = $1',
        [name],
      );
      const previous = applied.rows[0];
      if (previous) {
        if (previous.checksum !== checksum)
          throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query(
        'INSERT INTO public.schema_migrations(name, checksum) VALUES ($1, $2)',
        [name, checksum],
      );
    }
    return files.length;
  });
}
