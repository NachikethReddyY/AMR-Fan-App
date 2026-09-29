import { createDatabase } from '../../database/index.ts';
import { createApi } from '../../api/app.ts';
if (process.env.NODE_ENV !== 'test' || !process.send)
  throw new Error('Test-only API process.');
const pool = createDatabase();
const server = createApi({ pool });
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No test listener.');
  process.send?.({ port: address.port });
});
process.once('message', () => {
  server.closeAllConnections();
  server.close(() => {
    void pool.end().then(() => process.disconnect?.());
  });
});
