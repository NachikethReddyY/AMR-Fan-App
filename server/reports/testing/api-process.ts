/** Test-only owned HTTP composition. This does not register routes in createApi. */
import { createServer } from 'node:http';
import { ApiError } from '../../accounts/types.ts';
import { createDatabase } from '../../database/index.ts';
import { createAi } from '../../ai/index.ts';
import { createReports } from '../index.ts';
import { createStorage } from '../storage.ts';
import { createParser } from '../parser.ts';
import { handleReports } from '../http.ts';
if (process.env.NODE_ENV !== 'test' || !process.env.REPORT_TEST_STORAGE)
  throw new Error('Allocated test configuration required.');
const pool = createDatabase();
const ai = createAi({});
const reports = createReports({
  pool,
  storage: await createStorage({ root: process.env.REPORT_TEST_STORAGE }),
  parser: createParser(),
  extractReport: ai.extractReport,
});
const server = createServer(async (req, res) => {
  try {
    if (
      !(await handleReports({
        req,
        res,
        path: new URL(req.url ?? '/', 'http://test').pathname,
        token: req.headers.authorization?.slice(7) ?? '',
        reports,
      }))
    ) {
      res.writeHead(404);
      res.end();
    }
  } catch (error) {
    res.writeHead(error instanceof ApiError ? error.status : 500, {
      'Content-Type': 'application/json',
    });
    res.end(
      JSON.stringify({
        error: error instanceof ApiError ? error.message : 'Request failed.',
      }),
    );
  }
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
