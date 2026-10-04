import { createTransportServer } from './http.ts';

const host = process.env.TRANSPORT_HOST ?? '127.0.0.1';
const port = Number(process.env.TRANSPORT_PORT ?? 8081);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error(
    'TRANSPORT_PORT must be a leased port between 1024 and 65535.',
  );
const server = createTransportServer();
server.listen(port, host, () =>
  process.stdout.write(
    JSON.stringify({ event: 'transport_started', host, port }) + '\n',
  ),
);
function stop() {
  server.close();
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
