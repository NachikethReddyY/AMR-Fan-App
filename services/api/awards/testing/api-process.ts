import { createDatabase } from '../../database/index.ts';
import { createApi } from '../../api/app.ts';

if (process.env.NODE_ENV !== 'test') throw new Error('Test-only API process.');
const pool = createDatabase();
const server = createApi({
  pool,
  env: {
    NODE_ENV: 'test',
    AUTH_DEV_ENABLED: 'false',
    AUTH_ISSUER: 'https://synthetic.invalid',
    AUTH_AUDIENCE: 'awards-test',
    AUTH_JWKS_URL: 'https://synthetic.invalid/keys',
    AUTH_REQUIRED_SCOPE: 'account.access',
  },
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No listener.');
  process.stdout.write(
    JSON.stringify({
      event: 'listening',
      pid: process.pid,
      port: address.port,
    }) + '\n',
  );
});
process.once('SIGTERM', () => {
  server.close(async (error) => {
    await pool.end();
    process.stdout.write(
      JSON.stringify({
        event: 'closed',
        pid: process.pid,
        listener: true,
        pool: true,
      }) + '\n',
    );
    if (error) process.exitCode = 1;
  });
  server.closeIdleConnections();
});
