import { createDatabase } from '../../services/api/database/index.ts';
import { migrate } from '../../services/api/database/migrate.ts';

const pool = createDatabase();
try {
  const applied = await migrate(pool);
  process.stdout.write(
    JSON.stringify({ event: 'database_migrated', applied }) + '\n',
  );
} finally {
  await pool.end();
}
