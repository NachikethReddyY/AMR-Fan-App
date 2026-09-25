import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { after, beforeEach, test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { assignRole, ensureAccount } from '../accounts/store.ts';
import { createSession, revokeSession } from '../auth/session.ts';
import { adjustPoints, readPointsHistory } from '../points/index.ts';
import { ApiError } from '../accounts/types.ts';
import {
  createSubmission,
  listOwnSubmissions,
  moderateSubmission,
} from './index.ts';
import {
  contributeToSubmission,
  readSharedSubmissions,
  readOwnSubmissionParticipation,
  createInteractionSession,
  closeInteractionSession,
  listInteractionSessions,
  resolveSubmissionSelection,
} from './participation.ts';

const root = realpathSync.native(
  fileURLToPath(new URL('../../', import.meta.url)),
);
const expectedDatabase = `amr_${createHash('sha256').update(root).digest('hex').slice(0, 12)}_test`;
if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${expectedDatabase}`
)
  throw new Error('Use only this canonical worktree test database.');
const pool = createDatabase();
beforeEach(async () => {
  const actual = await pool.query('SELECT current_database() AS name');
  assert.equal(actual.rows[0].name, expectedDatabase);
  await pool.query(
    'DROP SCHEMA IF EXISTS app CASCADE; DROP TABLE IF EXISTS public.schema_migrations',
  );
  await migrate(pool);
});
after(() => pool.end());
const status = (expected: number) => (error: unknown) =>
  error instanceof ApiError && error.status === expected;
async function account(admin = false) {
  const value = await ensureAccount(pool, {
    issuer: 'urn:amr:participation-test',
    subject: randomUUID(),
  });
  if (admin)
    await assignRole(
      pool,
      value.id,
      'admin',
      'Synthetic participation fixture',
    );
  const { token } = await createSession(pool, value.id);
  const real = value.profiles.find((p) => p.kind === 'real');
  const demo = value.profiles.find((p) => p.kind === 'demo');
  assert.ok(real && demo);
  return { ...value, token, real, demo };
}
async function grant(admin: string, profileId: string, delta: number) {
  return adjustPoints(pool, admin, {
    targetProfileId: profileId,
    requestId: randomUUID(),
    delta,
    reason: 'Synthetic participation fixture',
  });
}
async function fixture(count = 1) {
  const admin = await account(true);
  const fan = await account();
  await grant(admin.token, fan.real.id, count * 500 + 1000);
  const submissions = [];
  for (let i = 0; i < count; i++) {
    const created = await createSubmission(pool, fan.token, fan.real.id, {
      requestId: randomUUID(),
      text: `Shared idea ${i}`,
      tag: i % 2 ? 'activity' : 'question',
      confirmedFee: 500,
    });
    submissions.push(created);
  }
  return { admin, fan, submissions };
}
async function approve(admin: string, id: string) {
  return moderateSubmission(pool, admin, id, {
    requestId: randomUUID(),
    status: 'approved',
  });
}
function vote(
  token: string,
  profileId: string,
  submissionId: string,
  points = 10,
  requestId = randomUUID(),
) {
  return contributeToSubmission({
    pool,
    token,
    profileId,
    submissionId,
    value: { requestId, points },
  });
}
function open(token: string, requestId = randomUUID()) {
  return createInteractionSession({ pool, token, value: { requestId } });
}
function close(token: string, sessionId: string, requestId = randomUUID()) {
  return closeInteractionSession({
    pool,
    token,
    sessionId,
    value: { requestId },
  });
}
function resolve(
  token: string,
  selectionId: string,
  action: 'release' | 'fulfil',
  requestId = randomUUID(),
) {
  return resolveSubmissionSelection({
    pool,
    token,
    selectionId,
    value: { requestId, action, reason: 'Demonstration resolution' },
  });
}
const ranking = (token: string, query: unknown = {}) =>
  readSharedSubmissions({ pool, token, query });
const history = (token: string, profileId: string) =>
  readPointsHistory(pool, token, profileId);
async function blockedBy(pid: number) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const rows = await pool.query(
      'SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))',
      [pid],
    );
    if (rows.rowCount) return;
    await delay(10);
  }
  assert.fail('Operation did not reach controlled lock wait.');
}

test('minimum vote, repeated intent, private linkage and immutable #11 receipt', async () => {
  const {
    admin,
    fan,
    submissions: [created],
  } = await fixture();
  const id = created.outcome.id;
  await assert.rejects(vote(fan.token, fan.real.id, id), status(409));
  await approve(admin.token, id);
  for (const points of [9, -10, 1.5])
    await assert.rejects(vote(fan.token, fan.real.id, id, points), status(400));
  const key = randomUUID();
  const result = await vote(fan.token, fan.real.id, id, 10, key);
  assert.equal(result.entry.balanceAfter, 990);
  assert.equal(result.entry.delta, -10);
  assert.equal(result.outcome.rankingPointsAfter, '10');
  assert.equal(result.outcome.pointsOperationId, result.entry.id);
  assert.deepEqual(await vote(fan.token, fan.real.id, id, 10, key), result);
  for (const [profileId, target, points] of [
    [fan.demo.id, id, 10],
    [fan.real.id, randomUUID(), 10],
    [fan.real.id, id, 20],
  ] as const)
    await assert.rejects(
      vote(fan.token, profileId, target, points, key),
      status(409),
    );
  await vote(fan.token, fan.real.id, id);
  assert.equal((await ranking(fan.token)).items[0].rankingPoints, '20');
  const current = (await listOwnSubmissions(pool, fan.token, fan.real.id))
    .submissions[0];
  assert.equal(current.rankingPoints, 0);
  assert.equal(current.pointsOperationId, created.entry.id);
  const states = await readOwnSubmissionParticipation({
    pool,
    token: fan.token,
    profileId: fan.real.id,
    query: {},
  });
  assert.deepEqual(
    states.items.map((x) => x.pointsOperationId),
    (await history(fan.token, fan.real.id)).entries
      .filter((e) => e.kind !== 'admin_adjustment')
      .map((e) => e.id),
  );
  for (const item of states.items)
    assert.equal(item.participation?.rankingPoints, '20');
  assert.deepEqual(
    (await history(fan.token, fan.real.id)).entries.find(
      (e) => e.id === created.entry.id,
    ),
    created.entry,
  );
});

test('concurrent retries, different targets and ordinary points spends cannot double-count or overspend', async () => {
  const { admin, fan, submissions } = await fixture(2);
  for (const item of submissions) await approve(admin.token, item.outcome.id);
  const id = submissions[0].outcome.id;
  const key = randomUUID();
  const copies = await Promise.all(
    Array.from({ length: 8 }, () => vote(fan.token, fan.real.id, id, 10, key)),
  );
  copies.forEach((copy) => assert.deepEqual(copy, copies[0]));
  await grant(admin.token, fan.real.id, -975); // 15 left
  const results = await Promise.allSettled(
    submissions.map((s) => vote(fan.token, fan.real.id, s.outcome.id)),
  );
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(
    results.filter((x) => x.status === 'rejected' && status(409)(x.reason))
      .length,
    1,
  );
  assert.equal((await history(fan.token, fan.real.id)).balance, 5);
  assert.equal(
    (await ranking(fan.token)).items.reduce(
      (n, s) => n + BigInt(s.rankingPoints),
      0n,
    ),
    20n,
  );
  await grant(admin.token, fan.real.id, 10);
  const mixed = await Promise.allSettled([
    vote(fan.token, fan.real.id, id),
    grant(admin.token, fan.real.id, -10),
  ]);
  assert.equal(mixed.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await history(fan.token, fan.real.id)).balance, 5);
});

test('all unavailable targets and late ledger failure roll back contribution and balance together', async () => {
  const {
    admin,
    fan,
    submissions: [created],
  } = await fixture();
  await moderateSubmission(pool, admin.token, created.outcome.id, {
    requestId: randomUUID(),
    status: 'rejected',
  });
  await assert.rejects(
    vote(fan.token, fan.real.id, created.outcome.id),
    status(409),
  );
  await assert.rejects(vote(fan.token, fan.real.id, randomUUID()), status(404));
  const approved = await createSubmission(pool, fan.token, fan.real.id, {
    requestId: randomUUID(),
    text: 'approved',
    confirmedFee: 500,
  });
  await approve(admin.token, approved.outcome.id);
  const before = await history(fan.token, fan.real.id);
  await assert.rejects(
    vote(fan.token, fan.real.id, approved.outcome.id, 501),
    status(409),
  );
  await pool.query(`CREATE FUNCTION app.fail_vote_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind = 'fan_submission_contribution' THEN RAISE EXCEPTION 'controlled write failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_vote_test BEFORE INSERT ON app.points_operations FOR EACH ROW EXECUTE FUNCTION app.fail_vote_test()`);
  try {
    await assert.rejects(
      vote(fan.token, fan.real.id, approved.outcome.id),
      /controlled write failure/,
    );
  } finally {
    await pool.query(
      'DROP TRIGGER fail_vote_test ON app.points_operations; DROP FUNCTION app.fail_vote_test()',
    );
  }
  assert.deepEqual(await history(fan.token, fan.real.id), before);
  assert.equal((await ranking(fan.token)).items[0].rankingPoints, '0');
});

test('real and persistent demo profiles share totals without leaking personal state', async () => {
  const {
    admin,
    fan,
    submissions: [created],
  } = await fixture();
  const other = await account();
  await approve(admin.token, created.outcome.id);
  await grant(admin.token, fan.demo.id, 30);
  await grant(admin.token, other.demo.id, 40);
  await vote(fan.token, fan.real.id, created.outcome.id, 10);
  await vote(fan.token, fan.demo.id, created.outcome.id, 20);
  await vote(other.token, other.demo.id, created.outcome.id, 30);
  assert.equal((await ranking(other.token)).items[0].rankingPoints, '60');
  assert.equal((await history(fan.token, fan.demo.id)).balance, 10);
  assert.equal((await history(other.token, other.demo.id)).balance, 10);
  assert.equal((await history(other.token, other.real.id)).balance, 0);
  await assert.rejects(
    vote(other.token, fan.real.id, created.outcome.id),
    status(404),
  );
  for (const token of [other.token, admin.token])
    await assert.rejects(
      readOwnSubmissionParticipation({
        pool,
        token,
        profileId: fan.real.id,
        query: {},
      }),
      status(404),
    );
  const publicRow = (await ranking(other.token)).items[0];
  assert.deepEqual(
    Object.keys(publicRow).sort(),
    [
      'id',
      'text',
      'tag',
      'approvedAt',
      'rankingPoints',
      'status',
      'fulfilment',
    ].sort(),
  );
  const resumed = await ensureAccount(pool, {
    issuer: 'urn:amr:participation-test',
    subject: (
      await pool.query('SELECT subject FROM app.principals WHERE id=$1', [
        fan.id,
      ])
    ).rows[0].subject,
  });
  assert.equal(
    resumed.profiles.find((p) => p.kind === 'demo')?.id,
    fan.demo.id,
  );
  assert.equal(resumed.profiles.find((p) => p.kind === 'demo')?.balance, 10);
});

test('mixed tags rank by exact totals, microsecond approval then final numeric sequence; close snapshot is immutable', async () => {
  const { admin, fan, submissions } = await fixture(5);
  // Fixture inserts terminal approvals with explicit time; no immutable row is edited.
  const times = [
    '2026-09-25T12:00:00.000002Z',
    '2026-09-25T12:00:00.000001Z',
    '2026-09-25T12:00:00.000001Z',
    '2026-09-25T12:00:00.000003Z',
    '2026-09-25T11:00:00.000001Z',
  ];
  for (let i = 0; i < submissions.length; i++) {
    await pool.query(
      'INSERT INTO app.fan_submission_decisions(submission_id,admin_id,request_id,status,decided_at) VALUES ($1,$2,$3,$4,$5)',
      [submissions[i].outcome.id, admin.id, randomUUID(), 'approved', times[i]],
    );
    if (i < 4)
      await vote(
        fan.token,
        fan.real.id,
        submissions[i].outcome.id,
        i === 3 ? 20 : 10,
      );
  }
  const expected = [3, 1, 2, 0, 4].map((i) => submissions[i].outcome.id);
  const first = await ranking(fan.token, { limit: 2 });
  const next = await ranking(fan.token, { limit: 2, after: first.nextCursor });
  assert.deepEqual(
    [...first.items, ...next.items].map((x) => x.id),
    expected.slice(0, 4),
  );
  assert.equal(first.items[1].approvedAt, times[1]);
  const created = await open(admin.token);
  const key = randomUUID();
  const selected = await close(admin.token, created.id, key);
  assert.deepEqual(
    selected.selections.map((s) => s.submissionId),
    expected.slice(0, 3),
  );
  assert.deepEqual(
    selected.selections.map((s) => s.rank),
    [1, 2, 3],
  );
  const original = JSON.stringify(selected);
  await assert.rejects(
    vote(fan.token, fan.real.id, selected.selections[0].submissionId),
    status(409),
  );
  await resolve(admin.token, selected.selections[0].id, 'release');
  await vote(fan.token, fan.real.id, selected.selections[0].submissionId, 50);
  assert.equal(
    JSON.stringify(await close(admin.token, created.id, key)),
    original,
  );
  assert.equal(JSON.stringify(await close(admin.token, created.id)), original);
});

test('open creation replay, empty and fewer-than-three close, release and demonstration fulfilment', async () => {
  const { admin, fan, submissions } = await fixture(3);
  const createKey = randomUUID();
  const first = await open(admin.token, createKey);
  assert.equal(first.state, 'open');
  assert.deepEqual(await open(admin.token, createKey), first);
  const empty = await close(admin.token, first.id);
  assert.deepEqual(empty.selections, []);
  await assert.rejects(close(admin.token, randomUUID()), status(404));
  for (const s of submissions) await approve(admin.token, s.outcome.id);
  const key = randomUUID();
  const paid = await vote(
    fan.token,
    fan.real.id,
    submissions[0].outcome.id,
    10,
    key,
  );
  await vote(fan.token, fan.real.id, submissions[1].outcome.id, 20);
  const second = await open(admin.token);
  const selected = await close(admin.token, second.id);
  assert.equal(selected.selections.length, 2);
  assert.deepEqual(
    await vote(fan.token, fan.real.id, submissions[0].outcome.id, 10, key),
    paid,
  );
  assert.equal(
    (await close(admin.token, (await open(admin.token)).id)).selections.length,
    0,
  );
  const fulfilled = await resolve(
    admin.token,
    selected.selections[0].id,
    'fulfil',
  );
  assert.equal(fulfilled.status, 'fulfilled');
  assert.equal(
    'fulfilment' in fulfilled && fulfilled.fulfilment,
    'demonstration',
  );
  await resolve(admin.token, selected.selections[1].id, 'release');
  await vote(fan.token, fan.real.id, selected.selections[1].submissionId);
  await assert.rejects(
    vote(fan.token, fan.real.id, fulfilled.submissionId),
    status(409),
  );
  const later = await close(admin.token, (await open(admin.token)).id);
  assert.deepEqual(
    later.selections.map((s) => s.submissionId),
    [selected.selections[1].submissionId],
  );
  const listed = await listInteractionSessions({
    pool,
    token: admin.token,
    query: {},
  });
  const prior = listed.items.find((s) => s.session.id === second.id);
  assert.ok(prior);
  assert.deepEqual(
    prior.selections.map((s) => s.status),
    ['fulfilled', 'released'],
  );
  assert.deepEqual(prior.session, selected);
  assert.equal(
    (await ranking(fan.token)).items.find(
      (s) => s.id === fulfilled.submissionId,
    )?.status,
    'fulfilled',
  );
});

test('admin authorization and action payload binding precede replay; terminal races keep one resolution', async () => {
  const {
    admin,
    fan,
    submissions: [s],
  } = await fixture();
  await approve(admin.token, s.outcome.id);
  await vote(fan.token, fan.real.id, s.outcome.id);
  await assert.rejects(open(fan.token), status(403));
  await assert.rejects(open(''), status(401));
  const session = await open(admin.token);
  const key = randomUUID();
  const selected = await close(admin.token, session.id, key);
  await assert.rejects(open(admin.token, key), status(409));
  await assert.rejects(
    close(admin.token, (await open(admin.token)).id, key),
    status(409),
  );
  const resolutionKey = randomUUID();
  const results = await Promise.allSettled(
    ['release', 'fulfil'].map((action) =>
      resolveSubmissionSelection({
        pool,
        token: admin.token,
        selectionId: selected.selections[0].id,
        value: { requestId: resolutionKey, action, reason: 'Race' },
      }),
    ),
  );
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(
    results.filter((x) => x.status === 'rejected' && status(409)(x.reason))
      .length,
    1,
  );
  await assignRole(pool, admin.id, 'fan', 'Revocation test');
  await assert.rejects(close(admin.token, session.id, key), status(403));
  await assert.rejects(
    listInteractionSessions({ pool, token: admin.token, query: {} }),
    status(403),
  );
  await revokeSession(pool, fan.token);
  await assert.rejects(ranking(fan.token), status(401));
});

test('contribution versus close has two legal serial orders and competing sessions cannot duplicate a selection', async () => {
  const {
    admin,
    fan,
    submissions: [s],
  } = await fixture();
  await approve(admin.token, s.outcome.id);
  await vote(fan.token, fan.real.id, s.outcome.id);
  const session = await open(admin.token);
  const blocker = await pool.connect();
  const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0]
    .pid;
  await blocker.query('BEGIN');
  await blocker.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('fan-submission-participation:v1',0))",
  );
  const contribution = vote(fan.token, fan.real.id, s.outcome.id, 20);
  try {
    await blockedBy(pid);
    const closing = close(admin.token, session.id);
    await blocker.query('COMMIT');
    await contribution;
    assert.equal((await closing).selections[0].rankingPointsAtClose, '30');
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
  const selected = (await close(admin.token, session.id)).selections[0];
  await resolve(admin.token, selected.id, 'release');
  const next = await open(admin.token);
  const lock = await pool.connect();
  const lockPid = (await lock.query('SELECT pg_backend_pid() AS pid')).rows[0]
    .pid;
  await lock.query('BEGIN');
  await lock.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('fan-submission-participation:v1',0))",
  );
  const closing = close(admin.token, next.id);
  try {
    await blockedBy(lockPid);
    const denied = assert.rejects(
      vote(fan.token, fan.real.id, s.outcome.id),
      status(409),
    );
    await lock.query('COMMIT');
    assert.equal((await closing).selections[0].rankingPointsAtClose, '30');
    await denied;
  } finally {
    await lock.query('ROLLBACK');
    lock.release();
  }
  await resolve(
    admin.token,
    (await close(admin.token, next.id)).selections[0].id,
    'release',
  );
  const sessions = await Promise.all([open(admin.token), open(admin.token)]);
  const both = await Promise.all(sessions.map((x) => close(admin.token, x.id)));
  assert.equal(
    both.reduce((n, s) => n + s.selections.length, 0),
    1,
  );
});

test('aggregate exceeds the per-profile integer bound without overflow or fee votes', async () => {
  const {
    admin,
    fan,
    submissions: [s],
  } = await fixture();
  await approve(admin.token, s.outcome.id);
  const max = 2_147_483_647;
  await grant(admin.token, fan.real.id, max - 1000);
  await vote(fan.token, fan.real.id, s.outcome.id, max);
  await grant(admin.token, fan.demo.id, max);
  await vote(fan.token, fan.demo.id, s.outcome.id, max);
  assert.equal((await ranking(fan.token)).items[0].rankingPoints, '4294967294');
  assert.equal(
    (await close(admin.token, (await open(admin.token)).id)).selections[0]
      .rankingPointsAtClose,
    '4294967294',
  );
});

for (const action of [
  'create',
  'close-replay',
  'vote',
  'vote-replay',
] as const) {
  test(`unchanged initial session-row wait denies expired ${action} and preserves stored outcomes`, async () => {
    const {
      admin,
      fan,
      submissions: [s],
    } = await fixture();
    await approve(admin.token, s.outcome.id);
    const key = randomUUID();
    const session = await open(admin.token);
    if (action === 'vote-replay')
      await vote(fan.token, fan.real.id, s.outcome.id, 10, key);
    if (action === 'close-replay') await close(admin.token, session.id, key);
    const actor = action.startsWith('vote') ? fan : admin;
    const hash = createHash('sha256').update(actor.token).digest('hex');
    const before = await history(fan.token, fan.real.id);
    const blocker = await pool.connect();
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0]
      .pid;
    await pool.query(
      "UPDATE app.sessions SET expires_at=clock_timestamp()+interval '1 second' WHERE token_hash=$1",
      [hash],
    );
    await blocker.query('BEGIN');
    await blocker.query(
      'SELECT token_hash FROM app.sessions WHERE token_hash=$1 FOR UPDATE',
      [hash],
    );
    const pending =
      action === 'create'
        ? open(admin.token)
        : action === 'close-replay'
          ? close(admin.token, session.id, key)
          : vote(fan.token, fan.real.id, s.outcome.id, 10, key);
    const denial = assert.rejects(pending, status(401));
    try {
      await blockedBy(pid);
      await blocker.query('SELECT pg_sleep(1.1)');
      await blocker.query('COMMIT');
      await denial;
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
    const refreshed = await createSession(pool, fan.id);
    assert.deepEqual(await history(refreshed.token, fan.real.id), before);
  });
}

test('valid authority survives a later profile-lock wait, and initial role/session revocation denies mutations', async () => {
  const {
    admin,
    fan,
    submissions: [s],
  } = await fixture();
  await approve(admin.token, s.outcome.id);
  const blocker = await pool.connect();
  const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0]
    .pid;
  const hash = createHash('sha256').update(fan.token).digest('hex');
  await pool.query(
    "UPDATE app.sessions SET expires_at=clock_timestamp()+interval '1 second' WHERE token_hash=$1",
    [hash],
  );
  await blocker.query('BEGIN');
  await blocker.query('SELECT id FROM app.profiles WHERE id=$1 FOR UPDATE', [
    fan.real.id,
  ]);
  const pending = vote(fan.token, fan.real.id, s.outcome.id);
  try {
    await blockedBy(pid);
    await blocker.query('SELECT pg_sleep(1.1)');
    await blocker.query('COMMIT');
    assert.equal((await pending).entry.delta, -10);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
  for (const boundary of ['role', 'session']) {
    const actor = await account(true);
    const holder = await pool.connect();
    const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid'))
      .rows[0].pid;
    await holder.query('BEGIN');
    if (boundary === 'role')
      await holder.query("UPDATE app.principals SET role='fan' WHERE id=$1", [
        actor.id,
      ]);
    else
      await holder.query(
        'UPDATE app.sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1',
        [createHash('sha256').update(actor.token).digest('hex')],
      );
    const denied = assert.rejects(
      open(actor.token),
      status(boundary === 'role' ? 403 : 401),
    );
    try {
      await blockedBy(holderPid);
      await holder.query('COMMIT');
      await denied;
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
    }
  }
});

test('concurrent close replays and resolution retries retain original snapshots and immutable audit rows', async () => {
  const {
    admin,
    fan,
    submissions: [s],
  } = await fixture();
  await approve(admin.token, s.outcome.id);
  const voteKey = randomUUID();
  const paid = await vote(fan.token, fan.real.id, s.outcome.id, 10, voteKey);
  const session = await open(admin.token);
  const closeKey = randomUUID();
  const closures = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      close(admin.token, session.id, i < 3 ? closeKey : randomUUID()),
    ),
  );
  closures.forEach((value) => assert.deepEqual(value, closures[0]));
  const key = randomUUID();
  const resolved = await resolve(
    admin.token,
    closures[0].selections[0].id,
    'fulfil',
    key,
  );
  assert.deepEqual(
    await resolve(admin.token, closures[0].selections[0].id, 'fulfil', key),
    resolved,
  );
  await assert.rejects(
    resolve(admin.token, resolved.id, 'release', key),
    status(409),
  );
  const before = JSON.stringify(
    (
      await pool.query(
        'SELECT to_jsonb(o) AS row FROM app.points_operations o ORDER BY sequence',
      )
    ).rows,
  );
  const statements = [
    [
      'UPDATE app.fan_submission_contributions SET points=11 WHERE points_operation_id=$1',
      [paid.entry.id],
    ],
    [
      'DELETE FROM app.fan_submission_contributions WHERE points_operation_id=$1',
      [paid.entry.id],
    ],
    ['TRUNCATE app.fan_submission_contributions', []],
    [
      "UPDATE app.fan_submission_admin_actions SET outcome='{}' WHERE request_id=$1",
      [closeKey],
    ],
    [
      'UPDATE app.fan_interaction_sessions SET closed_at=NULL WHERE id=$1',
      [session.id],
    ],
    [
      "UPDATE app.fan_submission_selections SET status='selected' WHERE id=$1",
      [resolved.id],
    ],
    ['UPDATE app.points_operations SET delta=-20 WHERE id=$1', [paid.entry.id]],
  ] as const;
  for (const [sql, parameters] of statements) {
    await assert.rejects(
      pool.query(sql, [...parameters]),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23514',
    );
  }
  assert.equal(
    JSON.stringify(
      (
        await pool.query(
          'SELECT to_jsonb(o) AS row FROM app.points_operations o ORDER BY sequence',
        )
      ).rows,
    ),
    before,
  );
  assert.deepEqual(
    await vote(fan.token, fan.real.id, s.outcome.id, 10, voteKey),
    paid,
  );
  const refreshed = await createSession(pool, fan.id);
  await revokeSession(pool, fan.token);
  await assert.rejects(
    vote(fan.token, fan.real.id, s.outcome.id, 10, voteKey),
    status(401),
  );
  assert.deepEqual(
    await vote(refreshed.token, fan.real.id, s.outcome.id, 10, voteKey),
    paid,
  );
});
