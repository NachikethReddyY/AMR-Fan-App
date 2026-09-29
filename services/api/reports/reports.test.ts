import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount, assignRole } from '../accounts/store.ts';
import { createSession, revokeSession } from '../auth/session.ts';
import { createStorage } from './storage.ts';
import { reportTestParser } from './testing/parser.ts';
import { createReports } from './index.ts';
import { syntheticPdf } from './testing/fixtures.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  !/\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use the allocated test database.');
const storageRoot = process.env.REPORT_TEST_STORAGE;
if (!storageRoot || !/\/amr_[a-f0-9]{12}\/test$/.test(storageRoot))
  throw new Error('Use allocated test storage.');
const pool = createDatabase();
const issuer = `urn:amr:reports-test:${randomUUID()}`;
let reports: ReturnType<typeof createReports>;
let admin: { id: string; token: string };
let fan: { id: string; token: string };
async function account(subject: string, role: 'fan' | 'admin') {
  const account = await ensureAccount(pool, { issuer, subject });
  if (role === 'admin')
    await assignRole(pool, account.id, role, 'Synthetic report test');
  return { id: account.id, ...(await createSession(pool, account.id)) };
}
before(async () => {
  await migrate(pool);
  admin = await account('admin', 'admin');
  fan = await account('fan', 'fan');
  reports = createReports({
    pool,
    storage: await createStorage({ root: storageRoot }),
    parser: reportTestParser(),
    extractReport: async () => ({
      kind: 'unavailable',
      reason: 'disabled',
      reviewRequired: true,
    }),
  });
});
after(async () => {
  await pool.end();
});

async function upload() {
  const document = await reports.reserve(admin.token, {
    requestId: randomUUID(),
    title: 'Synthetic water report',
    sourceKind: 'synthetic',
  });
  return reports.upload(
    admin.token,
    document.id,
    syntheticPdf([['Water result 20 litres in 2025. Method: meters.']]),
  );
}
function candidate(text: string) {
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
test('upload, correction and assigned-admin approval preserve exact provenance separately from balances', async () => {
  const doc = await upload();
  assert.equal(doc.status, 'review');
  assert.equal(
    doc.pages[0]?.text,
    'Water result 20 litres in 2025. Method: meters.',
  );
  const original = await reports.addCandidate(admin.token, doc.id, {
    requestId: randomUUID(),
    fields: { ...candidate(doc.pages[0].text), unit: null },
    reason: 'Synthetic incomplete candidate',
  });
  await assert.rejects(
    reports.decide(admin.token, original.candidateId, {
      requestId: randomUUID(),
      revisionId: original.id,
      kind: 'approved',
      expectedApprovalId: null,
      reason: 'Review',
    }),
    /required fields/,
  );
  const revision = await reports.revise(admin.token, original.candidateId, {
    requestId: randomUUID(),
    expectedRevisionId: original.id,
    fields: candidate(doc.pages[0].text),
    reason: 'Restore supported unit',
  });
  const decision = await reports.decide(admin.token, original.candidateId, {
    requestId: randomUUID(),
    revisionId: revision.id,
    kind: 'approved',
    expectedApprovalId: null,
    reason: 'Checked synthetic source',
  });
  assert.equal(decision.actorId, admin.id);
  assert.ok(decision.recordedAt);
  const official = await reports.official(fan.token);
  const metric = official.find((value) => value.approvalId === decision.id);
  assert.equal(metric?.fields.value?.text, '20');
  assert.equal(metric?.sourceKind, 'synthetic');
  assert.equal(metric?.period, '2025');
  const detail = await reports.detail(admin.token, doc.id);
  assert.equal(
    detail.revisions.find((value) => value.id === original.id)?.fields.fields
      .unit,
    null,
  );
  assert.equal(
    (
      await pool.query(
        'SELECT balance FROM app.profiles WHERE principal_id = $1',
        [admin.id],
      )
    ).rows.every((row) => row.balance === 0),
    true,
  );
});

async function readyCandidate() {
  const doc = await upload();
  const revision = await reports.addCandidate(admin.token, doc.id, {
    requestId: randomUUID(),
    fields: candidate(doc.pages[0].text),
    reason: 'Synthetic source review',
  });
  return { doc, revision };
}
function approval(
  revisionId: string,
  expectedApprovalId: string | null = null,
) {
  return {
    requestId: randomUUID(),
    revisionId,
    kind: 'approved',
    expectedApprovalId,
    reason: 'Checked synthetic evidence',
  };
}

test('concurrent repeated approval publishes once and conflicting replay is rejected', async () => {
  const { revision } = await readyCandidate();
  const action = approval(revision.id);
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      reports.decide(admin.token, revision.candidateId, action),
    ),
  );
  assert.equal(new Set(results.map((value) => value.id)).size, 1);
  assert.equal(
    (await reports.official(fan.token)).filter(
      (value) => value.candidateId === revision.candidateId,
    ).length,
    1,
  );
  await assert.rejects(
    reports.decide(admin.token, revision.candidateId, {
      ...action,
      reason: 'Different intent',
    }),
    /conflicts/,
  );
  const repeat = await reports.decide(admin.token, revision.candidateId, {
    ...action,
    requestId: randomUUID(),
  });
  assert.equal(repeat.id, results[0].id);
});

test('two replacements of one current approval commit exactly one successor and retain original evidence', async () => {
  const original = await readyCandidate();
  const approved = await reports.decide(
    admin.token,
    original.revision.candidateId,
    approval(original.revision.id),
  );
  const a = await readyCandidate(),
    b = await readyCandidate();
  const outcomes = await Promise.allSettled([
    reports.decide(
      admin.token,
      a.revision.candidateId,
      approval(a.revision.id, approved.id),
    ),
    reports.decide(
      admin.token,
      b.revision.candidateId,
      approval(b.revision.id, approved.id),
    ),
  ]);
  assert.equal(
    outcomes.filter((value) => value.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    outcomes.filter((value) => value.status === 'rejected').length,
    1,
  );
  assert.equal(
    (await reports.official(fan.token)).some(
      (value) => value.approvalId === approved.id,
    ),
    false,
  );
  assert.equal(
    (await reports.detail(admin.token, original.doc.id)).decisions[0]?.id,
    approved.id,
  );
  await assert.rejects(
    reports.decide(admin.token, original.revision.candidateId, {
      ...approval(original.revision.id),
      kind: 'rejected',
    }),
    /different decision/,
  );
});

test('rejected, pending and failed processing cannot change existing official data', async () => {
  const initial = await reports.official(fan.token);
  const { doc, revision } = await readyCandidate();
  await reports.decide(admin.token, revision.candidateId, {
    ...approval(revision.id),
    kind: 'rejected',
  });
  const failure = await reports.extract(admin.token, doc.id, {
    requestId: randomUUID(),
    pages: [1],
  });
  assert.equal(failure.status, 'unavailable');
  assert.equal(failure.failure, 'disabled');
  const broken = await reports.reserve(admin.token, {
    requestId: randomUUID(),
    title: 'Malformed synthetic PDF',
    sourceKind: 'synthetic',
  });
  await assert.rejects(
    reports.upload(admin.token, broken.id, Buffer.from('%PDF-1.7\nmalformed')),
    /could not be parsed/,
  );
  assert.equal((await reports.detail(admin.token, broken.id)).status, 'failed');
  assert.deepEqual(await reports.official(fan.token), initial);
});

test('anonymous, fan, foreign reservation and revoked role/session cannot mutate report records', async () => {
  const { doc, revision } = await readyCandidate();
  for (const token of ['', fan.token])
    await assert.rejects(
      reports.decide(token, revision.candidateId, approval(revision.id)),
    );
  const other = await account('other-admin', 'admin');
  await assert.rejects(
    reports.upload(
      other.token,
      doc.id,
      syntheticPdf([['Different synthetic source']]),
    ),
    /reservation/,
  );
  await assert.rejects(reports.source(fan.token, doc.id), /admin access/);
  await assignRole(pool, other.id, 'fan', 'Synthetic revocation test');
  await assert.rejects(
    reports.decide(other.token, revision.candidateId, approval(revision.id)),
    /admin access/,
  );
  const revoked = await account('revoked-admin', 'admin');
  await revokeSession(pool, revoked.token);
  await assert.rejects(
    reports.decide(revoked.token, revision.candidateId, approval(revision.id)),
    /Sign in/,
  );
  await assert.rejects(
    reports.addCandidate(admin.token, doc.id, {
      requestId: randomUUID(),
      fields: candidate(doc.pages[0].text),
      reason: 'Forged',
      actorId: fan.id,
    }),
    /Unexpected/,
  );
});

test('stale revisions conflict; approved snapshots survive later corrections and database reconnect', async () => {
  const { doc, revision } = await readyCandidate();
  const approved = await reports.decide(
    admin.token,
    revision.candidateId,
    approval(revision.id),
  );
  const next = await reports.revise(admin.token, revision.candidateId, {
    requestId: randomUUID(),
    expectedRevisionId: revision.id,
    fields: { ...candidate(doc.pages[0].text), method: null },
    reason: 'Review method omission',
  });
  await assert.rejects(
    reports.revise(admin.token, revision.candidateId, {
      requestId: randomUUID(),
      expectedRevisionId: revision.id,
      fields: candidate(doc.pages[0].text),
      reason: 'Stale edit',
    }),
    /Revision changed/,
  );
  assert.equal(
    (await reports.official(fan.token)).find(
      (value) => value.approvalId === approved.id,
    )?.fields.method?.text,
    'meters',
  );
  await assert.rejects(
    reports.decide(admin.token, revision.candidateId, approval(next.id)),
    /current approval/,
  );
  const replacement = await reports.decide(
    admin.token,
    revision.candidateId,
    approval(next.id, approved.id),
  );
  const reopenedPool = createDatabase();
  try {
    const reopened = createReports({
      pool: reopenedPool,
      storage: await createStorage({ root: storageRoot }),
      parser: reportTestParser(),
      extractReport: async () => null,
    });
    assert.equal(
      (await reopened.official(fan.token)).find(
        (value) => value.approvalId === replacement.id,
      )?.fields.method,
      null,
    );
    assert.deepEqual(
      await reopened.source(admin.token, doc.id),
      await reports.source(admin.token, doc.id),
    );
  } finally {
    await reopenedPool.end();
  }
  await assert.rejects(
    pool.query('DELETE FROM app.report_decisions WHERE id=$1', [approved.id]),
    /immutable/,
  );
  await assert.rejects(
    pool.query('UPDATE app.report_pages SET text=$2 WHERE document_id=$1', [
      doc.id,
      'changed',
    ]),
    /immutable/,
  );
});

test('completed extraction replay does not invoke the extractor again', async () => {
  const { doc } = await readyCandidate();
  let calls = 0;
  const service = createReports({
    pool,
    storage: await createStorage({ root: storageRoot }),
    parser: reportTestParser(),
    extractReport: async () => {
      calls++;
      return { kind: 'unavailable', reason: 'disabled', reviewRequired: true };
    },
  });
  const input = { requestId: randomUUID(), pages: [1] };
  const first = await service.extract(admin.token, doc.id, input);
  const second = await service.extract(admin.token, doc.id, input);
  assert.equal(second.id, first.id);
  assert.equal(calls, 1);
});

test('role revocation while approval waits is checked inside the transaction', async () => {
  const { revision } = await readyCandidate();
  const changing = await account('changing-admin', 'admin');
  const blocker = await pool.connect();
  await blocker.query('BEGIN');
  await blocker.query('SELECT id FROM app.principals WHERE id=$1 FOR UPDATE', [
    changing.id,
  ]);
  const deciding = reports.decide(
    changing.token,
    revision.candidateId,
    approval(revision.id),
  );
  const denied = assert.rejects(deciding, /admin access/);
  await blocker.query("UPDATE app.principals SET role='fan' WHERE id=$1", [
    changing.id,
  ]);
  await blocker.query('COMMIT');
  blocker.release();
  await denied;
  assert.equal(
    (await reports.official(fan.token)).some(
      (value) => value.candidateId === revision.candidateId,
    ),
    false,
  );
});

test('session revoked during parsing prevents persistence or publication', async () => {
  const changing = await account('parsing-admin', 'admin');
  const service = createReports({
    pool,
    storage: await createStorage({ root: storageRoot }),
    parser: {
      async parse() {
        await revokeSession(pool, changing.token);
        return {
          pages: [{ page: 1, text: 'Synthetic text' }],
          parserVersion: 'synthetic-fixture',
        };
      },
    },
    extractReport: async () => null,
  });
  const doc = await service.reserve(changing.token, {
    requestId: randomUUID(),
    title: 'Synthetic revocation boundary',
    sourceKind: 'synthetic',
  });
  await assert.rejects(
    service.upload(changing.token, doc.id, syntheticPdf([['Synthetic text']])),
    /Sign in/,
  );
  assert.equal(
    (await reports.detail(admin.token, doc.id)).status,
    'awaiting-upload',
  );
});

test('approval blocked on an unchanged session row is refused after expiry', async () => {
  const { createHash } = await import('node:crypto');
  const { revision } = await readyCandidate();
  const expiring = await account('expiring-lock-admin', 'admin');
  const hash = createHash('sha256').update(expiring.token).digest('hex');
  await pool.query(
    "UPDATE app.sessions SET expires_at=clock_timestamp()+interval '1 second' WHERE token_hash=$1",
    [hash],
  );
  const blocker = await pool.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      'SELECT token_hash FROM app.sessions WHERE token_hash=$1 FOR UPDATE',
      [hash],
    );
    const deciding = reports.decide(
      expiring.token,
      revision.candidateId,
      approval(revision.id),
    );
    const denied = assert.rejects(
      deciding,
      (error) =>
        error instanceof Error && 'status' in error && error.status === 401,
    );
    let blocked = false;
    for (let i = 0; i < 50; i++) {
      const state = await pool.query<{ blocked: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT token_hash FROM app.sessions%' AND cardinality(pg_blocking_pids(pid))>0) AS blocked",
      );
      if (state.rows[0]?.blocked) {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(
      blocked,
      true,
      'The approval must be observed waiting on the unchanged session lock.',
    );
    await blocker.query(
      'SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM (expires_at-clock_timestamp())))+0.05) FROM app.sessions WHERE token_hash=$1',
      [hash],
    );
    await blocker.query('COMMIT');
    await denied;
    assert.equal(
      (await reports.official(fan.token)).some(
        (value) => value.candidateId === revision.candidateId,
      ),
      false,
    );
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
});

test('saved pages precede deletion, retries skip parsing, and cleanup failure preserves approval inputs', async () => {
  const storage = await createStorage({ root: storageRoot });
  let calls = 0,
    failDelete = true;
  const text = 'Water result 20 litres in 2025. Method: meters.';
  const service = createReports({
    pool,
    storage: {
      ...storage,
      async remove(id) {
        const row = await pool.query(
          'SELECT status FROM app.report_documents WHERE id=$1',
          [id],
        );
        assert.equal(row.rows[0].status, 'review');
        const pages = await pool.query(
          'SELECT text FROM app.report_pages WHERE document_id=$1',
          [id],
        );
        assert.equal(pages.rows[0].text, text);
        if (failDelete) throw new Error('synthetic delete unavailable');
        await storage.remove(id);
      },
    },
    parser: {
      async parse() {
        calls++;
        return {
          pages: [{ page: 1, text }],
          parserVersion: 'synthetic-fixture',
        };
      },
    },
    extractReport: async () => null,
  });
  const doc = await service.reserve(admin.token, {
    requestId: randomUUID(),
    title: 'Synthetic cleanup retry',
    sourceKind: 'synthetic',
  });
  const bytes = syntheticPdf([[text]]);
  await storage.put(doc.id, bytes); // Synthetic pre-upgrade original.
  await assert.rejects(
    service.upload(admin.token, doc.id, bytes),
    /delete unavailable/,
  );
  assert.equal((await service.detail(admin.token, doc.id)).status, 'review');
  assert.ok((await storage.list()).some((row) => row.id === doc.id));
  failDelete = false;
  const retry = await service.upload(admin.token, doc.id, bytes);
  assert.equal(calls, 1);
  assert.equal(retry.pages[0].text, text);
  assert.ok(!(await storage.list()).some((row) => row.id === doc.id));
  assert.match(
    (await service.source(admin.token, doc.id)).toString(),
    /Page 1\nWater result/,
  );
  await service.upload(admin.token, doc.id, bytes);
  assert.equal(calls, 1);
  await assert.rejects(
    service.upload(admin.token, doc.id, syntheticPdf([['different']])),
    /immutable/,
  );
  assert.ok(!(await storage.list()).some((row) => row.id === doc.id));
  assert.ok(
    !(await service.official(fan.token)).some(
      (row) => row.documentId === doc.id,
    ),
  );
});

test('new parse failures leave no persisted PDF and retry retains the bound source identity', async () => {
  const storage = await createStorage({ root: storageRoot });
  let fails = true;
  const service = createReports({
    pool,
    storage: {
      ...storage,
      async put() {
        throw new Error('PDF persistence forbidden');
      },
    },
    parser: {
      async parse() {
        if (fails) throw new Error('synthetic parser failure');
        return {
          parserVersion: 'synthetic-fixture',
          pages: [{ page: 1, text: 'Synthetic retry text' }],
        };
      },
    },
    extractReport: async () => null,
  });
  const doc = await service.reserve(admin.token, {
    requestId: randomUUID(),
    title: 'Synthetic transient failure',
    sourceKind: 'synthetic',
  });
  const bytes = syntheticPdf([['Synthetic retry text']]);
  await assert.rejects(
    service.upload(admin.token, doc.id, bytes),
    /synthetic parser failure/,
  );
  assert.equal((await service.detail(admin.token, doc.id)).status, 'failed');
  assert.ok(!(await storage.list()).some((row) => row.id === doc.id));
  await assert.rejects(
    service.upload(admin.token, doc.id, syntheticPdf([['different']])),
    /immutable/,
  );
  fails = false;
  assert.equal(
    (await service.upload(admin.token, doc.id, bytes)).status,
    'review',
  );
  assert.ok(!(await storage.list()).some((row) => row.id === doc.id));
});

test('failed page persistence rolls back review state and retains no original', async () => {
  const storage = await createStorage({ root: storageRoot });
  let invalid = true;
  const service = createReports({
    pool,
    storage,
    parser: {
      async parse() {
        return {
          parserVersion: 'synthetic-fixture',
          pages: [
            { page: 1, text: invalid ? '\0' : 'Synthetic durable retry' },
          ],
        };
      },
    },
    extractReport: async () => null,
  });
  const doc = await service.reserve(admin.token, {
    requestId: randomUUID(),
    title: 'Synthetic failed persistence',
    sourceKind: 'synthetic',
  });
  const bytes = syntheticPdf([['Synthetic durable retry']]);
  await assert.rejects(service.upload(admin.token, doc.id, bytes));
  const detail = await service.detail(admin.token, doc.id);
  assert.equal(detail.status, 'awaiting-upload');
  assert.deepEqual(detail.pages, []);
  assert.ok(!(await storage.list()).some((row) => row.id === doc.id));
  invalid = false;
  assert.equal(
    (await service.upload(admin.token, doc.id, bytes)).pages[0].text,
    'Synthetic durable retry',
  );
});

test('upload slot rejects a competing request before its PDF body is buffered', async () => {
  const storage = await createStorage({ root: storageRoot });
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const parsing = new Promise<void>((resolve) => {
    started = resolve;
  });
  const service = createReports({
    pool,
    storage,
    parser: {
      async parse() {
        started();
        await waiting;
        return {
          parserVersion: 'synthetic-fixture',
          pages: [{ page: 1, text: 'Synthetic slot fixture' }],
        };
      },
    },
    extractReport: async () => null,
  });
  const doc = await service.reserve(admin.token, {
    requestId: randomUUID(),
    title: 'Synthetic slot fixture',
    sourceKind: 'synthetic',
  });
  const first = service.upload(
    admin.token,
    doc.id,
    syntheticPdf([['Synthetic slot fixture']]),
  );
  await parsing;
  let read = false;
  try {
    await assert.rejects(
      service.upload(admin.token, doc.id, async () => {
        read = true;
        return Buffer.alloc(0);
      }),
      { status: 503 },
    );
    assert.equal(read, false);
  } finally {
    release();
    await first;
  }
});
