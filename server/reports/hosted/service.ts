import { createServer, type IncomingMessage } from 'node:http';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createPublicKey } from 'node:crypto';
import { release } from 'node:os';
import { ApiError } from '../../accounts/types.ts';
import { MAX_FILE_BYTES } from '../contracts.ts';
import {
  sourceHash,
  verifyJob,
  JOB_AUDIENCE,
  TRIAL_AUDIENCE,
} from '../hosted-protocol.ts';
import { trialManifest } from './trial-fixtures.ts';
import { parseIsolated, runIsolated } from './runner.ts';

async function body(
  req: IncomingMessage,
  expected: number,
  signal: AbortSignal,
) {
  const chunks: Buffer[] = [];
  let size = 0;
  const abort = () => req.destroy();
  signal.addEventListener('abort', abort, { once: true });
  try {
    for await (const value of req) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      size += chunk.length;
      if (size > expected || size > MAX_FILE_BYTES)
        throw new ApiError(413, 'Upload exceeds limit.');
      chunks.push(chunk);
    }
    if (size !== expected) throw new ApiError(400, 'Upload size mismatch.');
    return Buffer.concat(chunks);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

export function createParserService({
  publicKey,
  image,
  ready,
  parse = parseIsolated,
  trial = false,
  hostStatus = {},
}: {
  publicKey: string;
  image: string;
  ready: boolean;
  parse?: typeof parseIsolated;
  trial?: boolean;
  hostStatus?: Record<string, string | number>;
}) {
  if (createPublicKey(publicKey).asymmetricKeyType !== 'ed25519')
    throw new Error('An Ed25519 verification key is required.');
  let active = false;
  const used = new Map<string, number>();
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json');
    const send = (status: number, value: unknown) => {
      res.writeHead(status);
      res.end(JSON.stringify(value));
    };
    if (req.url === '/health' && req.method === 'GET') {
      send(200, { alive: true });
      return;
    }
    if (req.url === '/ready' && req.method === 'GET') {
      send(ready ? 200 : 503, {
        ready,
        image,
        arch: process.arch,
        isolation: 'landlock-seccomp-v1',
        hostStatus,
      });
      return;
    }
    const isTrial = req.url === '/v1/trial';
    if (
      (req.url !== '/v1/parse' && !(isTrial && trial)) ||
      req.method !== 'POST'
    ) {
      send(404, { error: 'Not found.' });
      return;
    }
    let ownsSlot = false;
    const disconnected = new AbortController();
    const cancel = () => disconnected.abort();
    res.once('close', cancel);
    try {
      if (!ready && !isTrial)
        throw new ApiError(503, 'Parser isolation is not ready.');
      const authorization = req.headers.authorization ?? '';
      let job: ReturnType<typeof verifyJob>;
      try {
        job = verifyJob(
          authorization.startsWith('Bearer ') ? authorization.slice(7) : '',
          publicKey,
          Date.now(),
          isTrial ? TRIAL_AUDIENCE : JOB_AUDIENCE,
        );
      } catch {
        throw new ApiError(401, 'Invalid parser job.');
      }
      if (
        isTrial &&
        !trialManifest.some(
          (fixture) =>
            fixture.sha256 === job.sha256 && fixture.bytes === job.bytes,
        )
      )
        throw new ApiError(403, 'Fixture is not approved for this trial.');
      for (const [id, expiry] of used)
        if (expiry <= Date.now()) used.delete(id);
      if (used.has(job.id)) throw new ApiError(409, 'Job already used.');
      if (active || used.size >= 256)
        throw new ApiError(503, 'Parser is busy.');
      if (req.headers['content-type'] !== 'application/pdf')
        throw new ApiError(415, 'Use application/pdf.');
      if (
        req.headers['content-length'] &&
        Number(req.headers['content-length']) !== job.bytes
      )
        throw new ApiError(400, 'Upload size mismatch.');
      used.set(job.id, job.expiresAt);
      active = true;
      ownsSlot = true;
      const remaining = job.expiresAt - Date.now();
      if (remaining <= 0) throw new ApiError(401, 'Expired parser job.');
      const signal = AbortSignal.any([
        disconnected.signal,
        AbortSignal.timeout(Math.min(55_000, remaining)),
      ]);
      const bytes = await body(req, job.bytes, signal);
      if (sourceHash(bytes) !== job.sha256)
        throw new ApiError(400, 'Upload hash mismatch.');
      if (!/^%PDF-(1\.[0-7]|2\.0)/.test(bytes.subarray(0, 8).toString('ascii')))
        throw new ApiError(415, 'Use a PDF document.');
      const result = await parse(bytes, signal);
      send(200, {
        jobId: job.id,
        sha256: job.sha256,
        result,
        ...(isTrial
          ? {
              hostStatus,
              memory: { parentRssBytes: process.memoryUsage().rss },
            }
          : {}),
      });
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 503;
      send(status, {
        error:
          status === 422 ? 'PDF processing failed.' : 'Parser request refused.',
      });
    } finally {
      res.off('close', cancel);
      if (ownsSlot) active = false;
    }
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxConnections = 8;
  server.maxRequestsPerSocket = 4;
  return server;
}

async function startup() {
  // No remote readiness claim without the exact host-tested artifact and memory evidence.
  const image = process.env.REPORT_PARSER_IMAGE ?? '';
  if (!/^sha256:[a-f0-9]{64}$/.test(image))
    throw new Error('Parser image identity is required.');
  if (
    Object.keys(process.env).some((key) =>
      /SUPABASE|DATABASE_URL|API_KEY|SECRET|TOKEN|PRIVATE_KEY|SIGNING_KEY/.test(
        key,
      ),
    )
  )
    throw new Error('Parser service must not hold application credentials.');
  let ready = false,
    isolated = false;
  const hostStatus: Record<string, string | number> = {
    status: 'unverified',
    arch: process.arch,
    kernel: release(),
    uid: process.getuid?.() ?? -1,
  };
  try {
    if (
      process.platform !== 'linux' ||
      process.arch !== 'x64' ||
      process.getuid?.() === 0
    )
      throw new Error();
    hostStatus.status = 'checking-resource-controls';
    const controls = await Promise.all(
      ['memory.max', 'memory.swap.max', 'pids.max', 'cpu.max'].map((name) =>
        readFile(`/sys/fs/cgroup/${name}`, 'utf8'),
      ),
    );
    for (const [index, name] of [
      'memory.max',
      'memory.swap.max',
      'pids.max',
      'cpu.max',
    ].entries())
      hostStatus[name] = controls[index].trim();
    const memory = Number(controls[0]);
    const [quota, period] = controls[3].trim().split(' ').map(Number);
    if (!(
      memory > 0 &&
      memory <= 536_870_912 &&
      quota > 0 &&
      period > 0 &&
      quota / period <= 0.1
    ))
      throw new Error();
    hostStatus.status = 'checking-kernel-isolation';
    await writeFile(
      '/tmp/amr-parser-private-canary',
      'synthetic startup canary',
      { mode: 0o600 },
    );
    try {
      const probe = (
        await runIsolated('probe', Buffer.alloc(0), AbortSignal.timeout(5000))
      ).toString();
      const match = /^([0-9]+)\nisolated$/.exec(probe);
      if (!match || Number(match[1]) < 3) throw new Error();
      hostStatus.landlockAbi = Number(match[1]);
    } finally {
      await unlink('/tmp/amr-parser-private-canary');
    }
    isolated = true;
    hostStatus.status = 'local-controls-passed';
    // Set only after independent actual-host proof, including worst accepted input memory.
    ready = process.env.REPORT_PARSER_HOST_VERIFIED_IMAGE === image;
  } catch {
    ready = false;
  }
  const port = Number(process.env.PORT ?? '10000');
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
    throw new Error('Invalid parser port.');
  const server = createParserService({
    publicKey: process.env.REPORT_PARSER_PUBLIC_KEY ?? '',
    image,
    ready,
    trial: isolated && process.env.REPORT_PARSER_TRIAL_ENABLED === 'true',
    hostStatus,
  });
  server.listen(port, '0.0.0.0');
  process.once('SIGTERM', () => {
    server.close();
    server.closeIdleConnections();
  });
}
if (import.meta.main) await startup();
