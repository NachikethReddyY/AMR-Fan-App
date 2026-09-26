/** Actual API process for report restart acceptance. */
import { createApi } from '../../api/app.ts';
import { createDatabase } from '../../database/index.ts';
if (process.env.NODE_ENV !== 'test' || !process.env.REPORT_TEST_STORAGE)
  throw new Error('Allocated test configuration required.');
const pool = createDatabase();
const server = createApi({
  pool,
  env: {
    NODE_ENV: 'test',
    AUTH_DEV_ENABLED: 'true',
    API_HOST: '127.0.0.1',
    REPORT_STORAGE_ROOT: process.env.REPORT_TEST_STORAGE,
    REPORT_PARSER_MODE: process.env.REPORT_PARSER_IMAGE ? 'docker' : 'native',
    REPORT_PARSER_IMAGE: process.env.REPORT_PARSER_IMAGE,
  },
});
server.requestTimeout = 10000;
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No test address.');
  process.stdout.write(`${address.port}\n`);
});
process.once('SIGTERM', () =>
  server.close(() => {
    void pool.end();
  }),
);
