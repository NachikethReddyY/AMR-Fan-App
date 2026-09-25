import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount, assignRole } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';
import { ApiError } from '../accounts/types.ts';
import { createReports } from './index.ts';
import { createParser } from './parser.ts';
import { createStorage } from './storage.ts';
import { handleReports } from './http.ts';
import { serveReportsAdmin } from './admin.ts';
import { syntheticPdf } from './testing/fixtures.ts';
if (
  process.env.NODE_ENV !== 'test' ||
  !/\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use allocated test DB.');
const root = process.env.REPORT_TEST_STORAGE;
if (!root || !/\/amr_[a-f0-9]{12}\/test$/.test(root))
  throw new Error('Use allocated test storage.');
const pool = createDatabase();
let server: ReturnType<typeof createServer>,
  base = '',
  token = '',
  fan = '';
before(async () => {
  await migrate(pool);
  const issuer = `urn:amr:reports-http:${randomUUID()}`;
  const admin = await ensureAccount(pool, { issuer, subject: 'admin' });
  await assignRole(pool, admin.id, 'admin', 'Synthetic HTTP report test');
  token = (await createSession(pool, admin.id)).token;
  const account = await ensureAccount(pool, { issuer, subject: 'fan' });
  fan = (await createSession(pool, account.id)).token;
  const reports = createReports({
    pool,
    storage: await createStorage({ root }),
    parser: createParser(),
    extractReport: async () => ({
      kind: 'unavailable',
      reason: 'disabled',
      reviewRequired: true,
    }),
  });
  server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? '/', 'http://test').pathname;
      if (req.method === 'GET' && (await serveReportsAdmin(path, res))) return;
      const handled = await handleReports({
        req,
        res,
        path: new URL(req.url ?? '/', 'http://test').pathname,
        token: req.headers.authorization?.slice(7) ?? '',
        reports,
      });
      if (!handled) {
        res.writeHead(404);
        res.end();
      }
    } catch (error) {
      res.writeHead(error instanceof ApiError ? error.status : 500, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          error: error instanceof ApiError ? error.message : 'Failed',
        }),
      );
    }
  });
  server.requestTimeout = 10000;
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});
async function reserve() {
  const response = await fetch(base + '/v1/admin/reports', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestId: randomUUID(),
      title: 'Synthetic HTTP report',
      sourceKind: 'synthetic',
    }),
  });
  assert.equal(response.status, 201);
  return response.json();
}
test('HTTP upload keeps exact bytes; source download is an admin-only attachment', async () => {
  const doc = await reserve();
  const bytes = syntheticPdf([['Water result 20 litres in 2025.']]);
  const upload = await fetch(`${base}/v1/admin/reports/${doc.id}/source`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/pdf',
    },
    body: new Uint8Array(bytes),
  });
  assert.equal(upload.status, 200);
  assert.equal((await upload.json()).status, 'review');
  const source = await fetch(`${base}/v1/admin/reports/${doc.id}/source`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.match(source.headers.get('content-disposition') ?? '', /^attachment/);
  assert.equal(source.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await source.arrayBuffer()), bytes);
  const denied = await fetch(`${base}/v1/admin/reports/${doc.id}/source`, {
    headers: { Authorization: `Bearer ${fan}` },
  });
  assert.equal(denied.status, 403);
});

test('upload refuses wrong type/signature and enforces streamed bytes without Content-Length', async () => {
  const doc = await reserve();
  for (const [type, body] of [
    ['text/html', '<script>untrusted</script>'],
    ['application/pdf', 'not a PDF'],
  ]) {
    const response = await fetch(`${base}/v1/admin/reports/${doc.id}/source`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': type },
      body,
    });
    assert.equal(response.status, 415);
  }
  const { request } = await import('node:http');
  const status = await new Promise<number>((resolve, reject) => {
    const req = request(
      `${base}/v1/admin/reports/${doc.id}/source`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/pdf',
        },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.write('%PDF-1.7\n');
    for (let i = 0; i < 161; i++) req.write(Buffer.alloc(65536, 65));
    req.end();
  });
  assert.equal(status, 413);
  const detail = await fetch(`${base}/v1/admin/reports/${doc.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal((await detail.json()).sha256, null);
  const response = await fetch(base + '/v1/admin/reports', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ padding: 'x'.repeat(4096) }),
  });
  assert.equal(response.status, 413);
});

test('anonymous input is refused before PDF processing and unpublished detail is not fan-readable', async () => {
  const doc = await reserve();
  const response = await fetch(`${base}/v1/admin/reports/${doc.id}/source`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: '%PDF-1.7\nmalformed',
  });
  assert.equal(response.status, 401);
  const detail = await fetch(`${base}/v1/admin/reports/${doc.id}`, {
    headers: { Authorization: `Bearer ${fan}` },
  });
  assert.equal(detail.status, 403);
  const official = await fetch(base + '/v1/impact/official', {
    headers: { Authorization: `Bearer ${fan}` },
  });
  assert.equal(official.status, 200);
  assert.equal(
    (await official.json()).some(
      (value: { documentId: string }) => value.documentId === doc.id,
    ),
    false,
  );
});

test('original bytes persist across an actual owned API process restart', async () => {
  const { spawn } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  async function start() {
    const child = spawn(
      process.execPath,
      [
        ...process.execArgv.filter((arg) => arg !== '--test'),
        fileURLToPath(new URL('./testing/api-process.ts', import.meta.url)),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], env: process.env },
    );
    let output = '';
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Owned API startup timed out'));
      }, 5000);
      child.stdout.on('data', (chunk) => {
        output += String(chunk);
        if (output.includes('\n')) {
          clearTimeout(timer);
          resolve(Number(output.trim()));
        }
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (code) => {
        if (!output) {
          clearTimeout(timer);
          reject(new Error(`Owned API exited ${code}`));
        }
      });
    });
    return { child, base: `http://127.0.0.1:${port}` };
  }
  const doc = await reserve();
  const bytes = syntheticPdf([['Synthetic restart retained source']]);
  let ownedApi = await start();
  try {
    const uploaded = await fetch(
      `${ownedApi.base}/v1/admin/reports/${doc.id}/source`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/pdf',
        },
        body: new Uint8Array(bytes),
      },
    );
    assert.equal(uploaded.status, 200);
  } finally {
    ownedApi.child.kill('SIGTERM');
    await once(ownedApi.child, 'close');
  }
  ownedApi = await start();
  try {
    const source = await fetch(
      `${ownedApi.base}/v1/admin/reports/${doc.id}/source`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.deepEqual(Buffer.from(await source.arrayBuffer()), bytes);
  } finally {
    ownedApi.child.kill('SIGTERM');
    await once(ownedApi.child, 'close');
  }
});

test('owned admin assets use the established stylesheet and deny arbitrary asset paths', async () => {
  const response = await fetch(base + '/admin/reports/');
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get('content-security-policy') ?? '',
    /script-src 'self'/,
  );
  const html = await response.text();
  assert.match(html, /href="\/admin\/style.css"/);
  assert.match(html, /id="review-form"/);
  assert.match(html, /id="decision-form"/);
  const blocked = await fetch(base + '/admin/reports/private.pdf');
  assert.equal(blocked.status, 404);
});
