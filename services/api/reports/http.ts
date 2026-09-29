import type { IncomingMessage, ServerResponse } from 'node:http';
import { ApiError } from '../accounts/types.ts';
import { MAX_FILE_BYTES, object, uuid } from './contracts.ts';
import type { createReports } from './index.ts';

type Reports = ReturnType<typeof createReports>;
function readBytes(req: IncomingMessage, limit: number): Promise<Buffer> {
  if (Number(req.headers['content-length']) > limit)
    throw new ApiError(413, 'Request is too large.');
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let count = 0;
    const cleanup = () => {
      req.off('data', data);
      req.off('end', end);
      req.off('error', error);
      req.off('aborted', aborted);
    };
    const error = () => {
      cleanup();
      reject(new ApiError(400, 'Upload interrupted.'));
    };
    const aborted = () => error();
    const data = (chunk: Buffer) => {
      count += chunk.length;
      if (count > limit) {
        cleanup();
        req.resume();
        reject(new ApiError(413, 'Request is too large.'));
        return;
      }
      chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    req.on('data', data);
    req.on('end', end);
    req.on('error', error);
    req.on('aborted', aborted);
  });
}
async function json(req: IncomingMessage) {
  if (req.headers['content-type'] !== 'application/json')
    throw new ApiError(415, 'Use application/json.');
  const bytes = await readBytes(req, 4096);
  try {
    return object(JSON.parse(bytes.toString('utf8')));
  } catch {
    throw new ApiError(400, 'Invalid JSON object.');
  }
}
function send(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

/** Registration owner retains shared origin/rate/bearer controls; operations reauthorize. */
export async function handleReports({
  req,
  res,
  path,
  token,
  reports,
}: {
  req: IncomingMessage;
  res: ServerResponse;
  path: string;
  token: string;
  reports: Reports;
}): Promise<boolean> {
  if (path === '/v1/impact/official' && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    send(res, 200, await reports.official(token));
    return true;
  }
  if (!/^\/v1\/admin\/(reports(?:\/|$)|report-candidates\/)/.test(path))
    return false;
  await reports.access(token);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'",
  );
  if (path === '/v1/admin/reports') {
    if (req.method === 'POST') {
      send(res, 201, await reports.reserve(token, await json(req)));
      return true;
    }
    if (req.method === 'GET') {
      const url = new URL(req.url ?? '/', 'http://api.invalid');
      send(
        res,
        200,
        await reports.list(token, url.searchParams.get('after') ?? undefined),
      );
      return true;
    }
  }
  const match =
    /^\/v1\/admin\/reports\/([^/]+)(?:\/(source|candidates|extractions))?$/.exec(
      path,
    );
  if (match) {
    const id = uuid(match[1]);
    if (!match[2] && req.method === 'GET') {
      send(res, 200, await reports.detail(token, id));
      return true;
    }
    if (match[2] === 'source' && req.method === 'GET') {
      const bytes = await reports.source(token, id);
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-${id}.txt"`,
        'Content-Length': bytes.length,
      });
      res.end(bytes);
      return true;
    }
    if (match[2] === 'source' && req.method === 'PUT') {
      await reports.uploadAccess(token, id);
      if (req.headers['content-type'] !== 'application/pdf')
        throw new ApiError(415, 'Use application/pdf.');
      send(
        res,
        200,
        await reports.upload(token, id, () => readBytes(req, MAX_FILE_BYTES)),
      );
      return true;
    }
    if (match[2] === 'candidates' && req.method === 'POST') {
      send(res, 201, await reports.addCandidate(token, id, await json(req)));
      return true;
    }
    if (match[2] === 'extractions' && req.method === 'POST') {
      send(res, 201, await reports.extract(token, id, await json(req)));
      return true;
    }
  }
  const candidate =
    /^\/v1\/admin\/report-candidates\/([^/]+)\/(revisions|decisions)$/.exec(
      path,
    );
  if (candidate && req.method === 'POST') {
    const id = uuid(candidate[1]);
    const body = await json(req);
    send(
      res,
      201,
      candidate[2] === 'revisions'
        ? await reports.revise(token, id, body)
        : await reports.decide(token, id, body),
    );
    return true;
  }
  throw new ApiError(404, 'Report endpoint not found.');
}
