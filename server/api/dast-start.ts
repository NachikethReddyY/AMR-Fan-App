// Disposable internal-network scanner target, never a deployment entry point.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { createApi } from './app.ts';

execFileSync('pg_ctlcluster', ['15', 'main', 'start']);
const password = randomBytes(24).toString('hex');
execFileSync(
  'runuser',
  ['-u', 'postgres', '--', 'psql', '-v', 'ON_ERROR_STOP=1'],
  {
    input: `CREATE ROLE amr_scan LOGIN PASSWORD '${password}';\nCREATE DATABASE amr_scan OWNER amr_scan;\n`,
    stdio: ['pipe', 'ignore', 'pipe'],
  },
);
const pool = createDatabase({
  NODE_ENV: 'test',
  DATABASE_URL: `postgresql://amr_scan:${password}@127.0.0.1:5432/amr_scan`,
});
await migrate(pool);
const server = createApi({
  pool,
  env: {
    NODE_ENV: 'production',
    AUTH_DEV_ENABLED: 'false',
    AUTH_ISSUER: 'https://unprovisioned.example.test',
    AUTH_AUDIENCE: 'amr-api',
    AUTH_JWKS_URL: 'https://unprovisioned.example.test/keys',
    AUTH_REQUIRED_SCOPE: 'account.access',
  },
});
server.listen(3000, '0.0.0.0');
