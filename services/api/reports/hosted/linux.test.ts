import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID, createHash, generateKeyPairSync } from 'node:crypto';
import { readFile, lstat, utimes } from 'node:fs/promises';
import { test } from 'node:test';
import { createDatabase } from '../../database/index.ts';
import { migrate } from '../../database/migrate.ts';
import { ensureAccount, assignRole } from '../../accounts/store.ts';
import { createSession } from '../../auth/session.ts';
import { reportRuntime } from '../runtime.ts';
import { createReports } from '../index.ts';
import { handleReports } from '../http.ts';
import { createStorage } from '../storage.ts';
import { syntheticPdf } from '../testing/fixtures.ts';
import { parseIsolated, runIsolated } from './runner.ts';
import { createParserService } from './service.ts';
import { signJob, TRIAL_AUDIENCE } from '../hosted-protocol.ts';
import { trialFixtures } from './trial-fixtures.ts';
import { ApiError } from '../../accounts/types.ts';

if (
  process.platform !== 'linux' ||
  process.env.NODE_ENV !== 'test' ||
  process.env.REPORT_TEST_SANDBOX !== 'landlock'
)
  throw new Error('Use the leased Linux fixture runner.');
const root = process.env.REPORT_TEST_STORAGE;
if (
  !root ||
  !/\/amr_[a-f0-9]{12}\/test$/.test(root) ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use isolated generated test configuration.');

test('actual isolated Linux parser rejects invalid PDFs and recovers', async () => {
  assert.match(
    (
      await runIsolated('probe', Buffer.alloc(0), AbortSignal.timeout(5000))
    ).toString(),
    /^[0-9]+\nisolated$/,
  );
  const parse = (bytes: Buffer) =>
    parseIsolated(bytes, AbortSignal.timeout(10_000));
  for (const bytes of [
    Buffer.from('%PDF-1.7\nmalformed'),
    syntheticPdf([[]]),
    syntheticPdf(
      Array.from({ length: 101 }, () => ['Synthetic excessive pages']),
    ),
    await readFile(
      new URL('../testing/synthetic-encrypted.pdf', import.meta.url),
    ),
    await readFile(
      new URL('../testing/synthetic-image-only.pdf', import.meta.url),
    ),
  ])
    await assert.rejects(parse(bytes));
  const result = await parse(
    syntheticPdf([
      ['Synthetic 水 water result 20 litres in 2025.'],
      ['Synthetic CO₂ café'],
    ]),
  );
  assert.deepEqual(result.pages, [
    { page: 1, text: 'Synthetic 水 water result 20 litres in 2025.' },
    { page: 2, text: 'Synthetic CO₂ café' },
  ]);
  await assert.rejects(
    parseIsolated(
      syntheticPdf([['Synthetic deadline']]),
      AbortSignal.timeout(1),
    ),
  );
  assert.equal(
    (await parse(syntheticPdf([['Synthetic recovery']]))).pages[0].text,
    'Synthetic recovery',
  );
});

test('real HTTP upload -> isolated parse -> durable text -> legacy deletion -> admin approval -> official read', async () => {
  const pool = createDatabase();
  await migrate(pool);
  const storage = await createStorage({ root });
  const reports = createReports({
    pool,
    storage,
    parser: {
      parse: (bytes) => parseIsolated(bytes, AbortSignal.timeout(10_000)),
    },
    extractReport: async () => null,
  });
  const issuer = `urn:amr:linux-reports:${randomUUID()}`;
  const owner = await ensureAccount(pool, { issuer, subject: 'admin' });
  await assignRole(pool, owner.id, 'admin', 'Synthetic Linux report test');
  const admin = (await createSession(pool, owner.id)).token;
  const fanAccount = await ensureAccount(pool, { issuer, subject: 'fan' });
  const fan = (await createSession(pool, fanAccount.id)).token;
  const server = createServer(async (req, res) => {
    try {
      await handleReports({
        req,
        res,
        path: req.url ?? '/',
        token: (req.headers.authorization ?? '').slice(7),
        reports,
      });
    } catch (error) {
      res.writeHead(error instanceof ApiError ? error.status : 500, {
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify({ error: 'Synthetic request failed' }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const json = async (path: string, value?: unknown, token = admin) => {
    const response = await fetch(base + path, {
      method: value === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: value === undefined ? undefined : JSON.stringify(value),
    });
    assert.ok(response.ok, `HTTP ${response.status}`);
    return response.json();
  };
  try {
    const doc = await json('/v1/admin/reports', {
      requestId: randomUUID(),
      title: 'Synthetic HTTP lifecycle',
      sourceKind: 'synthetic',
    });
    const text = 'Water result 20 litres in 2025.';
    const bytes = syntheticPdf([[text]]);
    await storage.put(doc.id, bytes); // Pre-upgrade original exercises commit-before-delete.
    const upload = await fetch(base + `/v1/admin/reports/${doc.id}/source`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${admin}`,
        'Content-Type': 'application/pdf',
      },
      body: new Uint8Array(bytes),
    });
    assert.equal(upload.status, 200);
    const saved = await upload.json();
    assert.equal(saved.pages[0].text, text);
    assert.equal(
      saved.sha256,
      createHash('sha256').update(bytes).digest('hex'),
    );
    await assert.rejects(lstat(`${root}/${doc.id}.pdf`), { code: 'ENOENT' });
    const source = await fetch(base + `/v1/admin/reports/${doc.id}/source`, {
      headers: { Authorization: `Bearer ${admin}` },
    });
    assert.match(source.headers.get('content-type') ?? '', /^text\/plain/);
    assert.match(
      await source.text(),
      /Page 1\nWater result 20 litres in 2025\./,
    );
    const revision = await json(`/v1/admin/reports/${doc.id}/candidates`, {
      requestId: randomUUID(),
      reason: 'Synthetic review',
      fields: {
        name: 'Water',
        value: '20',
        unit: 'litres',
        period: '2025',
        category: null,
        meaning: 'result',
        method: null,
        evidence: { page: 1, start: 0, end: text.length, quote: text },
      },
    });
    const pending = await json('/v1/impact/official', undefined, fan);
    assert.ok(
      !pending.some((row: { documentId: string }) => row.documentId === doc.id),
    );
    await json(
      `/v1/admin/report-candidates/${revision.candidateId}/decisions`,
      {
        requestId: randomUUID(),
        revisionId: revision.id,
        kind: 'approved',
        expectedApprovalId: null,
        reason: 'Synthetic approved evidence',
      },
    );
    const official = await json('/v1/impact/official', undefined, fan);
    assert.equal(
      official.find((row: { documentId: string }) => row.documentId === doc.id)
        ?.fields.value.text,
      '20',
    );
    assert.deepEqual((await reports.detail(admin, doc.id)).pages, saved.pages);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});

test('signed synthetic trial HTTP executes the real isolated parser with production readiness closed', async () => {
  const keys = generateKeyPairSync('ed25519');
  const publicKey = keys.publicKey
    .export({ type: 'spki', format: 'pem' })
    .toString();
  const privateKey = keys.privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString();
  const server = createParserService({
    publicKey,
    image: 'sha256:' + 'a'.repeat(64),
    ready: false,
    trial: true,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(base + '/ready')).status, 503);
    for (const name of [
      'unicode-two-pages',
      'malformed',
      'unicode-two-pages',
    ]) {
      const fixture = trialFixtures.find((value) => value.name === name);
      assert.ok(fixture);
      const { token, job } = signJob(
        fixture.bytes,
        privateKey,
        Date.now(),
        TRIAL_AUDIENCE,
      );
      const response = await fetch(base + '/v1/trial', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/pdf',
        },
        body: new Uint8Array(fixture.bytes),
      });
      assert.equal(response.status, name === 'malformed' ? 422 : 200);
      if (response.ok) {
        const result = await response.json();
        assert.equal(result.sha256, job.sha256);
        assert.equal(result.result.pages.length, 2);
        assert.match(result.result.pages[0].text, /水/);
      }
    }
    assert.equal((await fetch(base + '/ready')).status, 503);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('legacy cleanup defaults to24hours, preserves active uploads and expires after release', async () => {
  const pool = createDatabase();
  const storage = await createStorage({ root });
  const id = randomUUID(),
    recent = randomUUID();
  await storage.put(id, Buffer.from('%PDF-1.7 synthetic old legacy'));
  await storage.put(recent, Buffer.from('%PDF-1.7 synthetic recent legacy'));
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await utimes(`${root}/${id}.pdf`, old, old);
  const blocker = await pool.connect();
  const runtime = reportRuntime(pool, {
    REPORT_STORAGE_ROOT: root,
    REPORT_PARSER_MODE: 'hosted',
  });
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      [`report-upload:${id}`],
    );
    await runtime();
    assert.ok(await lstat(`${root}/${id}.pdf`));
    await blocker.query('COMMIT');
    await runtime();
    await assert.rejects(lstat(`${root}/${id}.pdf`), { code: 'ENOENT' });
    assert.ok(await lstat(`${root}/${recent}.pdf`));
    // Missing hosted parser approval does not disable durable read composition.
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    await pool.end();
  }
});
