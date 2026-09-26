import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { before, after, test } from 'node:test';
import type { Server } from 'node:http';
import { createApi } from '../api/app.ts';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount, assignRole } from '../accounts/store.ts';
import { createSession, revokeSession } from '../auth/session.ts';
import { syntheticPdf } from './testing/fixtures.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use allocated test DB.');
const root = process.env.REPORT_TEST_STORAGE;
if (!root || !/\/amr_[a-f0-9]{12}\/test$/.test(root))
  throw new Error('Use allocated test storage.');
const image = process.env.REPORT_PARSER_IMAGE;
if (!image) throw new Error('Use the pinned offline parser image.');
const pool = createDatabase();
const issuer = `urn:amr:report-integration:${randomUUID()}`;
const env = {
  NODE_ENV: 'test',
  AUTH_DEV_ENABLED: 'true',
  API_HOST: '127.0.0.1',
  REPORT_FAILED_UPLOAD_TTL_SECONDS: '3600',
  REPORT_STORAGE_ROOT: root,
  REPORT_PARSER_MODE: 'docker',
  REPORT_PARSER_IMAGE: image,
};
let server: Server,
  base = '',
  admin = '',
  fan = '',
  second = '',
  adminId = '';
async function start(settings = env) {
  server = createApi({ pool, env: settings });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
}
async function stop() {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
before(async () => {
  await migrate(pool);
  for (const name of ['admin', 'fan', 'second']) {
    const account = await ensureAccount(pool, { issuer, subject: name });
    if (name !== 'fan')
      await assignRole(
        pool,
        account.id,
        'admin',
        'Synthetic registered report proof',
      );
    const session = await createSession(pool, account.id);
    if (name === 'admin') {
      admin = session.token;
      adminId = account.id;
    } else if (name === 'fan') fan = session.token;
    else second = session.token;
  }
  await start();
});
after(async () => {
  if (server?.listening) await stop();
  await pool.end();
});
async function json(
  path: string,
  method = 'GET',
  body?: unknown,
  token = admin,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, value: await response.json() };
}
async function upload(
  bytes = syntheticPdf([['Water result 20 litres in 2025. Method: meters.']]),
  kind = 'permitted',
) {
  const reserved = await json('/v1/admin/reports', 'POST', {
    requestId: randomUUID(),
    title: 'Synthetic source <img src=x onerror=alert(1)>',
    sourceKind: kind,
  });
  assert.equal(reserved.status, 201);
  const response = await fetch(
    base + `/v1/admin/reports/${reserved.value.id}/source`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${admin}`,
        'Content-Type': 'application/pdf',
      },
      body: new Uint8Array(bytes),
    },
  );
  return {
    id: reserved.value.id,
    status: response.status,
    value: await response.json(),
    bytes,
  };
}
function fields(text: string) {
  return {
    name: 'Water',
    value: '20',
    unit: 'litres',
    period: '2025',
    category: null,
    meaning: 'result',
    method: 'meters',
    evidence: { page: 1, start: 0, end: text.length, quote: text },
  };
}
test('registered upload/correction/approval retains exact source; concurrent retries and stale decisions are safe', async () => {
  const doc = await upload();
  assert.equal(doc.status, 200);
  assert.equal(
    doc.value.sha256,
    createHash('sha256').update(doc.bytes).digest('hex'),
  );
  const f = fields(doc.value.pages[0].text);
  const candidate = await json(
    `/v1/admin/reports/${doc.id}/candidates`,
    'POST',
    {
      requestId: randomUUID(),
      fields: { ...f, unit: null },
      reason: 'Missing supported unit',
    },
  );
  assert.equal(candidate.status, 201);
  const decide = (id: string) => ({
    requestId: randomUUID(),
    revisionId: id,
    kind: 'approved',
    expectedApprovalId: null,
    reason: 'Checked exact source',
  });
  assert.equal(
    (
      await json(
        `/v1/admin/report-candidates/${candidate.value.candidateId}/decisions`,
        'POST',
        decide(candidate.value.id),
      )
    ).status,
    409,
  );
  const revision = await json(
    `/v1/admin/report-candidates/${candidate.value.candidateId}/revisions`,
    'POST',
    {
      requestId: randomUUID(),
      expectedRevisionId: candidate.value.id,
      fields: f,
      reason: 'Restore literal unit',
    },
  );
  assert.equal(revision.status, 201);
  assert.equal(
    (
      await json(
        `/v1/admin/report-candidates/${candidate.value.candidateId}/decisions`,
        'POST',
        decide(candidate.value.id),
      )
    ).status,
    409,
  );
  const action = decide(revision.value.id);
  const results = await Promise.all(
    Array.from({ length: 3 }, () =>
      json(
        `/v1/admin/report-candidates/${candidate.value.candidateId}/decisions`,
        'POST',
        action,
      ),
    ),
  );
  assert.ok(results.every((r) => r.status === 201));
  assert.equal(new Set(results.map((r) => r.value.id)).size, 1);
  const official = await json('/v1/impact/official', 'GET', undefined, fan);
  assert.equal(official.status, 200);
  assert.equal(
    official.value.filter(
      (v: { approvalId: string }) => v.approvalId === results[0].value.id,
    ).length,
    1,
  );
  const extraction = await json(
    `/v1/admin/reports/${doc.id}/extractions`,
    'POST',
    { requestId: randomUUID(), pages: [1] },
  );
  assert.equal(extraction.value.status, 'unavailable');
  assert.equal(extraction.value.failure, 'disabled');
  assert.deepEqual(
    (await json('/v1/impact/official', 'GET', undefined, fan)).value,
    official.value,
  );
  assert.equal(
    (await json(`/v1/admin/reports/${doc.id}`, 'GET', undefined, fan)).status,
    403,
  );
  const bytes = await fetch(base + `/v1/admin/reports/${doc.id}/source`, {
    headers: { Authorization: `Bearer ${admin}` },
  });
  const retained = await bytes.text();
  assert.match(retained, /Page 1\n/);
  await stop();
  await start();
  assert.deepEqual(
    (await json('/v1/impact/official', 'GET', undefined, fan)).value,
    official.value,
  );
  const again = await fetch(base + `/v1/admin/reports/${doc.id}/source`, {
    headers: { Authorization: `Bearer ${admin}` },
  });
  assert.equal(await again.text(), retained);
});
test('registered parser and readiness failures preserve existing approved dashboard data', async () => {
  const before = (await json('/v1/impact/official', 'GET', undefined, fan))
    .value;
  for (const input of [
    Buffer.from('%PDF-1.7\nmalformed'),
    await readFile(
      new URL('./testing/synthetic-encrypted.pdf', import.meta.url),
    ),
    await readFile(
      new URL('./testing/synthetic-image-only.pdf', import.meta.url),
    ),
    syntheticPdf([[]]),
    syntheticPdf(
      Array.from({ length: 101 }, () => ['Synthetic oversized report']),
    ),
  ]) {
    const failed = await upload(input);
    assert.equal(failed.status, 422);
  }
  await stop();
  await start({ ...env, REPORT_PARSER_IMAGE: 'sha256:' + '0'.repeat(64) });
  const unavailable = await upload();
  assert.equal(unavailable.status, 503);
  assert.deepEqual(
    (await json('/v1/impact/official', 'GET', undefined, fan)).value,
    before,
  );
  await stop();
  await start();
  assert.equal((await upload()).status, 200);
  assert.deepEqual(
    (await json('/v1/impact/official', 'GET', undefined, fan)).value,
    before,
  );
});
test('registered source ownership and current role/session deny access before replay', async () => {
  const reserved = await json('/v1/admin/reports', 'POST', {
    requestId: randomUUID(),
    title: 'Owned synthetic report',
    sourceKind: 'synthetic',
  });
  const foreign = await fetch(
    base + `/v1/admin/reports/${reserved.value.id}/source`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${second}`,
        'Content-Type': 'application/pdf',
      },
      body: new Uint8Array(syntheticPdf([['Synthetic']])),
    },
  );
  assert.equal(foreign.status, 404);
  await assignRole(pool, adminId, 'fan', 'Synthetic revocation');
  assert.equal((await json('/v1/admin/reports')).status, 403);
  await assignRole(pool, adminId, 'admin', 'Restore synthetic review');
  await revokeSession(pool, admin);
  assert.equal((await json('/v1/admin/reports')).status, 401);
});
