import { createDatabase } from '../../database/index.ts';
import { createApi } from '../../api/app.ts';

if (process.env.NODE_ENV !== 'test') throw new Error('Test-only API process.');
const pool = createDatabase();
const server = createApi({
  pool,
  env: { NODE_ENV: 'test', AUTH_DEV_ENABLED: 'true', API_HOST: '127.0.0.1' },
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No test listener.');
  process.stdout.write(`${address.port}\n`);
});
process.once('SIGTERM', () =>
  server.close(() => {
    void pool.end();
  }),
);
