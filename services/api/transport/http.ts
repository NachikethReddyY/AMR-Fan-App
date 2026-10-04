import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { createOsrmRouter } from './osrm.ts';
import { departureInput, planInput } from './contracts.ts';
import { departures, planTransport } from './planner.ts';

function send(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}
async function readBody(req: IncomingMessage) {
  if (req.headers['content-type'] !== 'application/json')
    throw new Error('Use application/json.');
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 8192) throw new Error('Request is too large.');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
export function createTransportServer({
  osrmBaseUrl = process.env.OSRM_BASE_URL,
}: { osrmBaseUrl?: string } = {}) {
  const roadRouter = osrmBaseUrl ? createOsrmRouter(osrmBaseUrl) : undefined;
  let windowStart = Date.now();
  let requests = 0;
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://transport.invalid');
      if (
        req.method === 'GET' &&
        (url.pathname === '/' || url.pathname === '/health')
      )
        return send(res, 200, { status: 'ok', service: 'transport-mvp' });
      if (Date.now() - windowStart >= 60_000) {
        windowStart = Date.now();
        requests = 0;
      }
      if (++requests > 120)
        return send(res, 429, { error: 'Try again shortly.' });
      if (req.method === 'POST' && url.pathname === '/v1/transport/plan') {
        const parsed = planInput.safeParse(await readBody(req));
        if (!parsed.success)
          return send(res, 400, { error: 'Invalid transport plan.' });
        return send(res, 200, await planTransport(parsed.data, { roadRouter }));
      }
      if (req.method === 'GET' && url.pathname === '/v1/transport/departures') {
        const parsed = departureInput.safeParse(
          Object.fromEntries(url.searchParams),
        );
        if (!parsed.success)
          return send(res, 400, { error: 'Invalid departure query.' });
        return send(res, 200, departures(parsed.data));
      }
      return send(res, 404, { error: 'Not found.' });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Request failed.';
      return send(res, message === 'Request is too large.' ? 413 : 400, {
        error: message,
      });
    }
  });
}
