import { createDatabase } from '../../server/database/index.ts';
import { migrate } from '../../server/database/migrate.ts';

// This is an explicit release step. It is intentionally not part of the API
// container command: migrations require the separately provisioned migration
// identity and must finish before the API is made ready.
if (process.env.NODE_ENV !== 'production')
  throw new Error('Set NODE_ENV=production for the Azure migration step.');
if (process.env.AMR_MIGRATION_APPROVED !== 'true')
  throw new Error(
    'Set AMR_MIGRATION_APPROVED=true after reviewing the release and backup.',
  );
if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL must be injected by the release secret store.');

const pool = createDatabase();
try {
  const migrations = await migrate(pool);
  process.stdout.write(
    JSON.stringify({ event: 'migrations_applied', migrations }) + '\n',
  );
} catch {
  process.stderr.write(
    'Migration step failed; no database error or credential details are emitted.\n',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
