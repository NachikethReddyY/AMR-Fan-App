import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readImpactOverview } from './overview.ts';
import { parseOfficial } from './overview-contracts.ts';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { assignRole, ensureAccount } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';
import { fileURLToPath } from 'node:url';
import { namespaceFor } from '../../../scripts/local-db.mjs';
import { createApi } from '../api/app.ts';
import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { createReports } from '../reports/index.ts';
import { PARSER_VERSION } from '../reports/contracts.ts';
import type { ParsedReport } from '../reports/parser.ts';
import type { SourceStorage } from '../reports/storage.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${namespaceFor(fileURLToPath(new URL('../../', import.meta.url)))}_test`
)
  throw new Error('Owned test database required');
const pool = createDatabase();
test.after(async () => pool.end());

test('database overview permits owner and rejects foreign profile', async () => {
  await migrate(pool);
  const a = await ensureAccount(pool, {
    issuer: `urn:impact:${Math.random()}`,
    subject: 'a',
  });
  const b = await ensureAccount(pool, {
    issuer: `urn:impact:${Math.random()}`,
    subject: 'b',
  });
  const ap = a.profiles.find((p) => p.kind === 'real')!;
  const bp = b.profiles.find((p) => p.kind === 'real')!;
  const at = (await createSession(pool, a.id)).token;
  const result = await readImpactOverview({
    pool,
    token: at,
    profileId: ap.id,
    readOfficial: async () => [],
  });
  assert.equal(result.official.status, 'empty');
  assert.equal(result.fan.personal.participation.kind, 'available');
  await assert.rejects(
    () =>
      readImpactOverview({
        pool,
        token: at,
        profileId: bp.id,
        readOfficial: async () => [],
      }),
    /Profile access denied|not found|owner/,
  );
});

test('HTTP overview enforces auth ownership strict query and missing official source', async () => {
  await migrate(pool);
  const issuer = `urn:impact-http:${randomUUID()}`;
  const a = await ensureAccount(pool, { issuer, subject: 'a' });
  const b = await ensureAccount(pool, { issuer, subject: 'b' });
  const ap = a.profiles.find((p) => p.kind === 'real')!;
  const bp = b.profiles.find((p) => p.kind === 'real')!;
  const token = (await createSession(pool, a.id)).token;
  const server = createApi({
    pool,
    env: {
      NODE_ENV: 'test',
      AUTH_ISSUER: 'https://fixture.example.test/',
      AUTH_AUDIENCE: 'amr-api',
      AUTH_JWKS_URL: 'https://fixture.example.test/keys',
      AUTH_REQUIRED_SCOPE: 'account.access',
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/v1/impact/overview`;
  const headers = { Authorization: `Bearer ${token}` };
  try {
    assert.equal((await fetch(`${base}?profileId=${ap.id}`)).status, 401);
    assert.equal(
      (await fetch(`${base}?profileId=${bp.id}`, { headers })).status,
      404,
    );
    for (const query of [
      `profileId=${ap.id}&profileId=${ap.id}`,
      `profileId=${ap.id}&unknown=1`,
      'profileId=invalid',
    ]) {
      assert.equal(
        (await fetch(`${base}?${query}`, { headers })).status,
        400,
        query,
      );
    }
    const response = await fetch(`${base}?profileId=${ap.id}`, { headers });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.official, {
      status: 'unavailable',
      metrics: [],
      reason: 'source_unavailable',
    });
    assert.equal(body.fan.personal.participation.kind, 'available');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('populated overview isolates owners and excludes synthetic credits', async () => {
  await migrate(pool);
  const issuer = `urn:impact-populated:${randomUUID()}`;
  const a = await ensureAccount(pool, { issuer, subject: 'a' });
  const b = await ensureAccount(pool, { issuer, subject: 'b' });
  const ap = a.profiles.find((p) => p.kind === 'real')!;
  const bp = b.profiles.find((p) => p.kind === 'real')!;
  const demo = a.profiles.find((p) => p.kind === 'demo')!;
  const at = (await createSession(pool, a.id)).token;
  const bt = (await createSession(pool, b.id)).token;
  const read = (token: string, profileId: string) =>
    readImpactOverview({
      pool,
      token,
      profileId,
      readOfficial: async () => [],
    });
  const before = (await read(at, ap.id)).fan.community.participation;
  assert.equal(before.kind, 'available');
  if (before.kind !== 'available') throw new Error('Community unavailable');
  async function credit(
    actor: string,
    profile: string,
    context: 'production' | 'synthetic_test',
  ) {
    const assessment = randomUUID(),
      operation = randomUUID(),
      request = randomUUID();
    const hash =
      randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    await pool.query(
      `INSERT INTO app.activity_assessments(id,profile_id,request_id,payload_digest,status,image_hashes,result,completed_at) VALUES ($1,$2,$3,$4,'accepted',$5,'{}',clock_timestamp())`,
      [assessment, profile, request, hash, JSON.stringify([hash])],
    );
    await pool.query(
      `INSERT INTO app.points_operations(id,actor_id,profile_id,request_id,kind,fingerprint,delta,balance_before,balance_after,reason,outcome) VALUES ($1,$2,$3,$4,'activity_evidence',$5,50,0,50,'Fixture reward','{}')`,
      [operation, actor, profile, request, hash],
    );
    await pool.query(
      `INSERT INTO app.activity_reward_claims(assessment_id,operation_id,profile_id,request_id,payload_digest,image_hashes,source_context) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        assessment,
        operation,
        profile,
        request,
        hash,
        JSON.stringify([hash]),
        context,
      ],
    );
  }
  await credit(a.id, ap.id, 'production');
  await credit(b.id, bp.id, 'production');
  await credit(a.id, ap.id, 'synthetic_test');
  const ar = await read(at, ap.id),
    br = await read(bt, bp.id),
    dr = await read(at, demo.id);
  assert.deepEqual(ar.fan.personal.participation, {
    kind: 'available',
    activityCount: 1,
    missionsCompleted: 0,
    pointsEarned: 50,
  });
  assert.deepEqual(br.fan.personal.participation, {
    kind: 'available',
    activityCount: 1,
    missionsCompleted: 0,
    pointsEarned: 50,
  });
  assert.deepEqual(ar.fan.community.participation, {
    kind: 'available',
    activityCount: before.activityCount + 2,
    missionsCompleted: before.missionsCompleted,
  });
  assert.deepEqual(dr.fan.personal.participation, {
    kind: 'unavailable',
    reason: 'demo_profile',
  });
});

test('overview preserves permitted report provenance and filters synthetic metrics', async () => {
  await migrate(pool);
  const a = await ensureAccount(pool, {
    issuer: `urn:impact-report:${randomUUID()}`,
    subject: randomUUID(),
  });
  const profile = a.profiles.find((p) => p.kind === 'real')!;
  const token = (await createSession(pool, a.id)).token;
  const span = (text: string) => ({ text, start: 0, end: text.length });
  const metric = (
    sourceKind: 'permitted' | 'synthetic',
    approvalId = randomUUID(),
  ) => ({
    approvalId,
    candidateId: randomUUID(),
    documentId: randomUUID(),
    title: 'Energy report',
    sourceKind,
    sha256: 'a'.repeat(64),
    parserVersion: 'fixture-parser-v1',
    reviewerId: randomUUID(),
    approvedAt: '2026-09-29T00:00:00.000Z',
    fields: {
      name: span('Energy'),
      value: span('42'),
      unit: span('kWh'),
      period: span('2025'),
      category: null,
      meaning: span('result'),
      method: span('meter'),
    },
    evidence: { page: 1, quote: 'Energy 42 kWh 2025', start: 0, end: 19 },
    missing: [],
    period: '2025',
  });
  const permitted = metric('permitted');
  const synthetic = metric('synthetic');
  const result = await readImpactOverview({
    pool,
    token,
    profileId: profile.id,
    readOfficial: async () => [permitted, synthetic],
  });
  assert.equal(result.official.status, 'available');
  assert.deepEqual(
    result.official.metrics.map((m) => m.approvalId),
    [permitted.approvalId],
  );
  assert.equal(result.official.metrics[0]?.documentId, permitted.documentId);
  assert.equal(
    result.official.metrics[0]?.evidence.quote,
    permitted.evidence.quote,
  );
});

test('approved report lifecycle preserves current permitted provenance and excludes non-current sources', async () => {
  await migrate(pool);
  const admin = await ensureAccount(pool, {
    issuer: `urn:rpt:${randomUUID()}`,
    subject: randomUUID(),
  });
  await assignRole(pool, admin.id, 'admin', 'fixture');
  const fan = await ensureAccount(pool, {
    issuer: `urn:rpt:${randomUUID()}`,
    subject: randomUUID(),
  });
  const adminToken = (await createSession(pool, admin.id)).token;
  const fanToken = (await createSession(pool, fan.id)).token;
  const profile = fan.profiles.find((value) => value.kind === 'real');
  assert.ok(profile);

  const sourceFiles = new Map<string, { bytes: Buffer; createdAt: number }>();
  const storage: SourceStorage = {
    async get(id, expectedHash) {
      const file = sourceFiles.get(id);
      if (
        !file ||
        createHash('sha256').update(file.bytes).digest('hex') !== expectedHash
      )
        throw new Error('fixture source is missing or has the wrong hash');
      return Buffer.from(file.bytes);
    },
    async put(id, bytes) {
      const copy = Buffer.from(bytes);
      sourceFiles.set(id, { bytes: copy, createdAt: Date.now() });
      return {
        sha256: createHash('sha256').update(copy).digest('hex'),
        bytes: copy.length,
      };
    },
    async list() {
      return [...sourceFiles.entries()].map(([id, value]) => ({
        id,
        createdAt: value.createdAt,
      }));
    },
    async remove(id) {
      sourceFiles.delete(id);
    },
    async cleanupIncomplete() {},
  };
  const pageText = 'Energy result 42 kWh in 2025. Method: meter.';
  const parser = {
    async parse(_bytes: Buffer): Promise<ParsedReport> {
      return {
        pages: [{ page: 1, text: pageText }],
        parserVersion: PARSER_VERSION,
      };
    },
  };
  const reports = createReports({
    pool,
    storage,
    parser,
    extractReport: async () => ({
      kind: 'unavailable',
      reason: 'disabled',
      reviewRequired: true,
    }),
    allowPermittedSources: true,
  });
  const source = Buffer.from('%PDF-1.7\nfixture');
  const fields = {
    name: 'Energy',
    value: '42',
    unit: 'kWh',
    period: '2025',
    category: null,
    meaning: 'result',
    method: 'meter',
    evidence: { page: 1, start: 0, end: pageText.length, quote: pageText },
  };
  async function draft(title: string, sourceKind: 'permitted' | 'synthetic') {
    const document = await reports.reserve(adminToken, {
      requestId: randomUUID(),
      title,
      sourceKind,
    });
    const uploaded = await reports.upload(adminToken, document.id, source);
    const revision = await reports.addCandidate(adminToken, document.id, {
      requestId: randomUUID(),
      fields,
      reason: `Fixture review for ${title}`,
    });
    return { document: uploaded, revision };
  }
  async function approve(
    title: string,
    sourceKind: 'permitted' | 'synthetic',
    expectedApprovalId: string | null = null,
  ) {
    const value = await draft(title, sourceKind);
    const decision = await reports.decide(
      adminToken,
      value.revision.candidateId,
      {
        requestId: randomUUID(),
        revisionId: value.revision.id,
        kind: 'approved',
        expectedApprovalId,
        reason: `Fixture approval for ${title}`,
      },
    );
    return { ...value, decision };
  }

  const current = await approve('Current permitted metric', 'permitted');
  const pending = await draft('Pending permitted metric', 'permitted');
  const rejected = await draft('Rejected permitted metric', 'permitted');
  const rejectedDecision = await reports.decide(
    adminToken,
    rejected.revision.candidateId,
    {
      requestId: randomUUID(),
      revisionId: rejected.revision.id,
      kind: 'rejected',
      expectedApprovalId: null,
      reason: 'Fixture rejected metric',
    },
  );
  const superseded = await approve('Superseded permitted metric', 'permitted');
  const replacementRevision = await reports.revise(
    adminToken,
    superseded.revision.candidateId,
    {
      requestId: randomUUID(),
      expectedRevisionId: superseded.revision.id,
      fields,
      reason: 'Fixture replacement revision',
    },
  );
  const replacement = await reports.decide(
    adminToken,
    superseded.revision.candidateId,
    {
      requestId: randomUUID(),
      revisionId: replacementRevision.id,
      kind: 'approved',
      expectedApprovalId: superseded.decision.id,
      reason: 'Fixture replacement approval',
    },
  );
  const synthetic = await approve('Synthetic approved metric', 'synthetic');

  assert.ok(pending.document.pages[0]?.text);
  assert.ok(rejectedDecision.id);
  const official = await reports.official(fanToken);
  const expected = parseOfficial(
    official.filter(
      (metric) =>
        metric.approvalId === current.decision.id ||
        metric.approvalId === replacement.id,
    ),
  );
  const overview = await readImpactOverview({
    pool,
    token: fanToken,
    profileId: profile.id,
    readOfficial: (token) => reports.official(token),
  });
  assert.equal(overview.official.status, 'available');
  const metricsById = new Map(
    overview.official.metrics.map((metric) => [metric.approvalId, metric]),
  );
  for (const metric of expected)
    assert.deepEqual(metricsById.get(metric.approvalId), metric);
  assert.deepEqual(
    [current.decision.id, replacement.id]
      .filter((id) => metricsById.has(id))
      .sort(),
    [current.decision.id, replacement.id].sort(),
  );
  assert.equal(
    overview.official.metrics.some(
      (metric) => metric.approvalId === superseded.decision.id,
    ),
    false,
  );
  assert.equal(
    overview.official.metrics.some(
      (metric) => metric.approvalId === rejectedDecision.id,
    ),
    false,
  );
  assert.equal(
    overview.official.metrics.some(
      (metric) => metric.approvalId === synthetic.decision.id,
    ),
    false,
  );
});
