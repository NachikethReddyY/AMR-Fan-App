import { createDatabase } from '../../database/index.ts';
import { requireOwnTestDatabase } from './test-server.ts';
import { createApi } from '../../api/app.ts';
requireOwnTestDatabase();
const pool = createDatabase();
const server = createApi({
  pool,
  env: { NODE_ENV: 'test', AUTH_DEV_ENABLED: 'true', API_HOST: '127.0.0.1' },
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string')
    process.stdout.write(`${address.port}\n`);
});
process.once('SIGTERM', () => {
  server.close(() => {
    void pool.end();
  });
  server.closeIdleConnections();
});
