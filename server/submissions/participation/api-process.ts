import { createDatabase } from '../../database/index.ts';
import {
  participationTestServer,
  requireOwnTestDatabase,
} from './test-server.ts';
requireOwnTestDatabase();
const pool = createDatabase();
const server = participationTestServer(pool);
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
