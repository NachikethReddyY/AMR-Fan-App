import { createDatabase } from '../database/index.ts';
import { createApi } from './app.ts';

const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('API_PORT must be a leased port between 1024 and 65535.');
const pool = createDatabase();
const server = createApi({ pool, env: { ...process.env, API_HOST: host } });
await pool.query('SELECT 1 FROM app.principals LIMIT 1');
server.listen(port, host, () =>
  process.stdout.write(
    JSON.stringify({ event: 'api_started', host, port }) + '\n',
  ),
);
function stop() {
  server.close(() => {
    void pool.end();
  });
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
