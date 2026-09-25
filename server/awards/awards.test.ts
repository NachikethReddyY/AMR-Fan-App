import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { namespaceFor } from '../../scripts/local-db.mjs';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { assignRole, ensureAccount } from '../accounts/store.ts';
import { createSession, revokeSession } from '../auth/session.ts';
import { createJourneyService } from '../journeys/store.ts';
import { adjustPoints, readPointsHistory } from '../points/index.ts';
import { readJourneyAward, settleJourneyAward } from './store.ts';
import { settleSyntheticJourneyAward } from './testing/service.ts';
import { awardRoute } from './testing/fixtures.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${namespaceFor(fileURLToPath(new URL('../../', import.meta.url)))}_test`
)
  throw new Error('Use only the allocated awards worktree test database.');
const pool = createDatabase();
const issuer = `urn:amr:awards-test:${randomUUID()}`;
before(() => migrate(pool));
after(() => pool.end());

async function fixture(kg = 2.4, missing = false, live = false) {
  const account = await ensureAccount(pool, { issuer, subject: randomUUID() });
  const profile = account.profiles.find((item) => item.kind === 'real');
  assert.ok(profile);
  const token = (await createSession(pool, account.id)).token;
  let now = Date.now();
  const journeys = createJourneyService({
    pool,
    env: { NODE_ENV: 'test', JOURNEY_FIXTURES_ENABLED: 'true' },
    clock: () => now,
  });
  const route = awardRoute(kg, now);
  if (live)
    route.source = { kind: 'live', provider: 'synthetic-negative-control' };
  const prepared = await journeys.prepare(
    token,
    { profileId: profile.id, requestId: randomUUID() },
    route,
  );
  const captureSessionId = randomUUID();
  const active = await journeys.start(token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
  });
  assert.ok(active.startedAtMs !== null);
  const samples = Array.from({ length: 6 }, (_, index) => ({
    id: randomUUID(),
    acquiredAtMs: now + index * 60000,
    receivedAtMs: now + index * 60000,
    latitude: 1.3 + index * 0.002,
    longitude: 103.8,
    accuracyMeters: 5,
    context: 'background',
    mocked: false,
  }));
  now += 300000;
  await journeys.appendEvidence(token, active.id, {
    requestId: randomUUID(),
    captureSessionId,
    samples: missing ? [samples[0], samples[5]] : samples,
  });
  const finished = await journeys.finish(token, active.id, {
    requestId: randomUUID(),
    captureSessionId,
    endedAtMs: now,
    reason: 'arrival',
  });
  const input = {
    profileId: profile.id,
    requestId: randomUUID(),
    assessmentVersion: finished.assessment.version,
    assessmentRevision: finished.assessment.revision,
  };
  return {
    account,
    profile,
    token,
    journeys,
    journeyId: active.id,
    finished,
    samples,
    captureSessionId,
    input,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

test('real PostgreSQL settlement joins trusted journey, automatic credit, receipt and immutable History', async () => {
  const f = await fixture(10);
  assert.equal(f.finished.assessment.status, 'satisfies_configured_rules');
  const result = await settleSyntheticJourneyAward({
    pool,
    token: f.token,
    journeyId: f.journeyId,
    input: f.input,
  });
  assert.equal(result.entry.delta, 500);
  assert.equal(result.outcome.cumulativeAutomaticCredit, 500);
  const history = await readPointsHistory(pool, f.token, f.profile.id);
  assert.equal(history.balance, 500);
  assert.equal(history.entries.length, 1);
  const state = await readJourneyAward({
    pool,
    token: f.token,
    journeyId: f.journeyId,
  });
  assert.equal(state.cumulativeAutomaticCredit, 500);
  assert.deepEqual(state.latestReceipt, result.outcome.receipt);
});

test('same-key replay and concurrent new keys cannot repeat the capped journey award', async () => {
  const f = await fixture(60);
  const args = { pool, token: f.token, journeyId: f.journeyId, input: f.input };
  const first = await settleSyntheticJourneyAward(args);
  assert.equal(first.entry.delta, 2000);
  assert.deepEqual(await settleSyntheticJourneyAward(args), first);
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      settleSyntheticJourneyAward({
        ...args,
        input: { ...f.input, requestId: randomUUID() },
      }),
    ),
  );
  assert.ok(
    results.every(
      (r) =>
        r.entry.delta === 0 && r.outcome.cumulativeAutomaticCredit === 2000,
    ),
  );
  const history = await readPointsHistory(pool, f.token, f.profile.id);
  assert.equal(history.balance, 2000);
  assert.equal(history.entries.filter((e) => e.delta > 0).length, 1);
  await assert.rejects(
    settleSyntheticJourneyAward({
      ...args,
      input: { ...f.input, assessmentRevision: f.input.assessmentRevision + 1 },
    }),
    { status: 409 },
  );
  const uppercase = {
    ...args,
    journeyId: f.journeyId.toUpperCase(),
    input: {
      ...f.input,
      profileId: f.profile.id.toUpperCase(),
      requestId: f.input.requestId.toUpperCase(),
    },
  };
  assert.deepEqual(await settleSyntheticJourneyAward(uppercase), first);
});

test('fallback and later evidence append only the difference independently of manual corrections', async () => {
  const f = await fixture(2.4, true);
  assert.equal(f.finished.assessment.status, 'insufficient_evidence');
  const args = { pool, token: f.token, journeyId: f.journeyId, input: f.input };
  const fallback = await settleSyntheticJourneyAward(args);
  assert.equal(fallback.entry.delta, 50);
  assert.equal(
    fallback.outcome.receipt.assessment.status,
    'insufficient_evidence',
  );
  await assignRole(pool, f.account.id, 'admin', 'Synthetic adjustment test');
  await adjustPoints(pool, f.token, {
    targetProfileId: f.profile.id,
    requestId: randomUUID(),
    delta: -30,
    reason: 'Synthetic correction, original automatic credit retained',
  });
  await assignRole(pool, f.account.id, 'fan', 'Revoke synthetic admin');
  await assert.rejects(
    adjustPoints(pool, f.token, {
      targetProfileId: f.profile.id,
      requestId: randomUUID(),
      delta: 1,
      reason: 'Must refuse revoked admin',
    }),
    { status: 403 },
  );
  const accepted = await f.journeys.appendEvidence(f.token, f.journeyId, {
    requestId: randomUUID(),
    captureSessionId: f.captureSessionId,
    samples: f.samples.slice(1, 5),
  });
  assert.equal(accepted.assessment.status, 'satisfies_configured_rules');
  const next = {
    ...args,
    input: {
      ...f.input,
      requestId: randomUUID(),
      assessmentRevision: accepted.assessment.revision,
    },
  };
  const [a, b] = await Promise.all([
    settleSyntheticJourneyAward(next),
    settleSyntheticJourneyAward({
      ...next,
      input: { ...next.input, requestId: randomUUID() },
    }),
  ]);
  assert.equal(a.entry.delta + b.entry.delta, 70);
  assert.equal(
    (await readPointsHistory(pool, f.token, f.profile.id)).balance,
    90,
  );
  assert.deepEqual(await settleSyntheticJourneyAward(args), fallback);
  await assert.rejects(
    settleSyntheticJourneyAward({
      ...args,
      input: { ...f.input, requestId: randomUUID() },
    }),
    { status: 409 },
  );
  const records = await pool.query(
    'SELECT receipt FROM app.journey_award_assessments WHERE journey_id=$1',
    [f.journeyId],
  );
  assert.equal(records.rowCount, 2);
  f.advance(7 * 24 * 60 * 60 * 1000);
  await f.journeys.cleanup();
  assert.equal((await readJourneyAward(args)).cumulativeAutomaticCredit, 120);
  assert.deepEqual(await settleSyntheticJourneyAward(next), a);
});

test('missing endpoint denies fallback; small expected awards are bounded at twenty', async () => {
  const small = await fixture(0.4, true);
  const result = await settleSyntheticJourneyAward({
    pool,
    token: small.token,
    journeyId: small.journeyId,
    input: small.input,
  });
  assert.equal(result.entry.delta, 20);
  const f = await fixture(2.4, true);
  // Synthetic persisted fixture at the server boundary; never a client field.
  await pool.query(
    "UPDATE app.journeys SET summary=jsonb_set(summary, '{assessment,arrivalRecorded}', 'false') WHERE id=$1",
    [f.journeyId],
  );
  const denied = await settleSyntheticJourneyAward({
    pool,
    token: f.token,
    journeyId: f.journeyId,
    input: f.input,
  });
  assert.equal(denied.entry.delta, 0);
  assert.equal(denied.outcome.receipt.result.decision.kind, 'no_award');
});

test('production calculation does not credit; non-test or live provenance cannot enable synthetic accounting', async () => {
  const f = await fixture();
  const args = { pool, token: f.token, journeyId: f.journeyId, input: f.input };
  const result = await settleJourneyAward(args);
  assert.equal(result.entry.delta, 0);
  assert.equal(result.outcome.targetPoints, 120);
  assert.equal(result.outcome.receipt.result.decision.kind, 'full');
  assert.equal(result.outcome.creditContext, 'production_unavailable');
  const original = process.env.NODE_ENV;
  try {
    for (const mode of ['development', 'production'] as const) {
      process.env.NODE_ENV = mode;
      assert.throws(
        () => settleSyntheticJourneyAward(args),
        /requires NODE_ENV=test/,
      );
    }
  } finally {
    process.env.NODE_ENV = original;
  }
  const live = await fixture(2.4, false, true);
  await assert.rejects(
    settleSyntheticJourneyAward({
      pool,
      token: live.token,
      journeyId: live.journeyId,
      input: live.input,
    }),
    { status: 403 },
  );
  assert.equal(
    (await readPointsHistory(pool, live.token, live.profile.id)).balance,
    0,
  );
});

test('anonymous, expired/revoked, cross-owner, forged input and demo-target requests fail before effects or replay', async () => {
  const f = await fixture();
  const other = await fixture();
  const args = { pool, token: f.token, journeyId: f.journeyId, input: f.input };
  await settleSyntheticJourneyAward(args);
  await assert.rejects(
    settleSyntheticJourneyAward({ ...args, token: 'invalid' }),
    { status: 401 },
  );
  await assert.rejects(
    settleSyntheticJourneyAward({ ...args, token: other.token }),
    { status: 404 },
  );
  await assert.rejects(
    settleSyntheticJourneyAward({
      ...args,
      token: other.token,
      input: {
        ...f.input,
        profileId: other.profile.id,
        requestId: randomUUID(),
      },
    }),
    { status: 404 },
  );
  await assert.rejects(readJourneyAward({ ...args, token: other.token }), {
    status: 404,
  });
  for (const key of [
    'amount',
    'eligibility',
    'factor',
    'role',
    'actor',
    'projection',
    'syntheticTest',
  ]) {
    assert.throws(
      () =>
        settleSyntheticJourneyAward({
          ...args,
          input: { ...f.input, [key]: true },
        }),
      { status: 400 },
    );
  }
  const demo = f.account.profiles.find((p) => p.kind === 'demo');
  assert.ok(demo);
  await assert.rejects(
    settleSyntheticJourneyAward({
      ...args,
      input: { ...f.input, profileId: demo.id, requestId: randomUUID() },
    }),
    { status: 409 },
  );
  await revokeSession(pool, f.token);
  await assert.rejects(settleSyntheticJourneyAward(args), { status: 401 });
  await assert.rejects(readJourneyAward(args), { status: 401 });
  const expired = await createSession(pool, other.account.id);
  await pool.query(
    'UPDATE app.sessions SET expires_at=clock_timestamp() WHERE token_hash=$1',
    [createHash('sha256').update(expired.token).digest('hex')],
  );
  await assert.rejects(
    settleSyntheticJourneyAward({ ...args, token: expired.token }),
    { status: 401 },
  );
});

test('points overflow rolls back callback receipt/state with balance and History, then an unchanged retry succeeds', async () => {
  const f = await fixture();
  await assignRole(pool, f.account.id, 'admin', 'Synthetic overflow test');
  await adjustPoints(pool, f.token, {
    targetProfileId: f.profile.id,
    requestId: randomUUID(),
    delta: 2147483647,
    reason: 'Synthetic upper bound',
  });
  const args = { pool, token: f.token, journeyId: f.journeyId, input: f.input };
  await assert.rejects(settleSyntheticJourneyAward(args), { status: 409 });
  assert.equal((await readJourneyAward(args)).latestReceipt, null);
  const history = await readPointsHistory(pool, f.token, f.profile.id);
  assert.equal(history.balance, 2147483647);
  assert.equal(history.entries.length, 1);
  assert.equal(
    (
      await pool.query(
        'SELECT id FROM app.journey_award_assessments WHERE journey_id=$1',
        [f.journeyId],
      )
    ).rowCount,
    0,
  );
  await adjustPoints(pool, f.token, {
    targetProfileId: f.profile.id,
    requestId: randomUUID(),
    delta: -200,
    reason: 'Synthetic room for retry',
  });
  assert.equal((await settleSyntheticJourneyAward(args)).entry.delta, 120);
});

test('receipts and automatic state reject mutation/removal and same-assessment basis substitution', async () => {
  const f = await fixture();
  const args = { pool, token: f.token, journeyId: f.journeyId, input: f.input };
  const first = await settleSyntheticJourneyAward(args);
  await assert.rejects(
    pool.query(
      "UPDATE app.journey_award_assessments SET receipt='{}' WHERE journey_id=$1",
      [f.journeyId],
    ),
  );
  await assert.rejects(
    pool.query(
      'DELETE FROM app.journey_award_assessments WHERE journey_id=$1',
      [f.journeyId],
    ),
  );
  await assert.rejects(
    pool.query(
      'UPDATE app.journey_award_state SET cumulative_automatic_credit=0 WHERE journey_id=$1',
      [f.journeyId],
    ),
  );
  await assert.rejects(
    pool.query('DELETE FROM app.journey_award_state WHERE journey_id=$1', [
      f.journeyId,
    ]),
  );
  await pool.query(
    "UPDATE app.journeys SET summary=jsonb_set(summary, '{basis,calculation,factors,0,kgCo2ePerPassengerKm}', '3') WHERE id=$1",
    [f.journeyId],
  );
  assert.deepEqual(await settleSyntheticJourneyAward(args), first);
  await assert.rejects(
    settleSyntheticJourneyAward({
      ...args,
      input: { ...f.input, requestId: randomUUID() },
    }),
    { status: 409 },
  );
});

async function waitForBlocker(pid: number) {
  for (let i = 0; i < 150; i++) {
    const waiting = await pool.query<{ count: string }>(
      'SELECT count(*)::text FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))',
      [pid],
    );
    if (Number(waiting.rows[0].count) > 0) return;
    await setTimeout(10);
  }
  assert.fail('Expected an observed own-database row lock wait.');
}

test('observed journey lock wait serializes fallback, late evidence and the difference-only top-up', async () => {
  const f = await fixture(2.4, true);
  const blocker = await pool.connect();
  let pending: ReturnType<typeof settleSyntheticJourneyAward> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = (
      await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
    ).rows[0].pid;
    await blocker.query('SELECT id FROM app.journeys WHERE id=$1 FOR UPDATE', [
      f.journeyId,
    ]);
    pending = settleSyntheticJourneyAward({
      pool,
      token: f.token,
      journeyId: f.journeyId,
      input: f.input,
    });
    await waitForBlocker(pid);
    const evidence = f.journeys.appendEvidence(f.token, f.journeyId, {
      requestId: randomUUID(),
      captureSessionId: f.captureSessionId,
      samples: f.samples.slice(1, 5),
    });
    await blocker.query('COMMIT');
    assert.equal((await pending).entry.delta, 50);
    const next = await evidence;
    const topup = await settleSyntheticJourneyAward({
      pool,
      token: f.token,
      journeyId: f.journeyId,
      input: {
        ...f.input,
        requestId: randomUUID(),
        assessmentRevision: next.assessment.revision,
      },
    });
    assert.equal(topup.entry.delta, 70);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    await pending?.catch(() => {});
  }
});

test('fresh clock after a session authority-row wait refuses expired settlement before replay', async () => {
  const f = await fixture();
  const args = { pool, token: f.token, journeyId: f.journeyId, input: f.input };
  const original = await settleSyntheticJourneyAward(args);
  const hash = createHash('sha256').update(f.token).digest('hex');
  await pool.query(
    "UPDATE app.sessions SET expires_at=clock_timestamp()+interval '0.4 seconds' WHERE token_hash=$1",
    [hash],
  );
  const blocker = await pool.connect();
  let pending: ReturnType<typeof settleSyntheticJourneyAward> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = (
      await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
    ).rows[0].pid;
    await blocker.query(
      'SELECT token_hash FROM app.sessions WHERE token_hash=$1 FOR UPDATE',
      [hash],
    );
    pending = settleSyntheticJourneyAward(args);
    const denial = assert.rejects(pending, { status: 401 });
    await waitForBlocker(pid);
    await blocker.query('SELECT pg_sleep(0.45)');
    await blocker.query('COMMIT');
    await denial;
    const fresh = (await createSession(pool, f.account.id)).token;
    assert.deepEqual(
      await settleSyntheticJourneyAward({ ...args, token: fresh }),
      original,
    );
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    await pending?.catch(() => {});
  }
});

test('expiry during the later profile wait preserves the accepted authority-lock semantics', async () => {
  const f = await fixture();
  const hash = createHash('sha256').update(f.token).digest('hex');
  await pool.query(
    "UPDATE app.sessions SET expires_at=clock_timestamp()+interval '0.4 seconds' WHERE token_hash=$1",
    [hash],
  );
  const blocker = await pool.connect();
  let pending: ReturnType<typeof settleSyntheticJourneyAward> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = (
      await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
    ).rows[0].pid;
    await blocker.query('SELECT id FROM app.profiles WHERE id=$1 FOR UPDATE', [
      f.profile.id,
    ]);
    pending = settleSyntheticJourneyAward({
      pool,
      token: f.token,
      journeyId: f.journeyId,
      input: f.input,
    });
    await waitForBlocker(pid);
    await blocker.query('SELECT pg_sleep(0.45)');
    await blocker.query('COMMIT');
    assert.equal((await pending).entry.delta, 120);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    await pending?.catch(() => {});
  }
});

test('later disqualifying evidence and lower targets preserve prior credit and retained receipts', async () => {
  const f = await fixture();
  const args = { pool, token: f.token, journeyId: f.journeyId, input: f.input };
  const first = await settleSyntheticJourneyAward(args);
  const reassessed = await f.journeys.appendEvidence(f.token, f.journeyId, {
    requestId: randomUUID(),
    captureSessionId: f.captureSessionId,
    samples: [{ ...f.samples[2], id: randomUUID(), latitude: 1.5 }],
  });
  assert.equal(reassessed.assessment.status, 'ineligible');
  const later = await settleSyntheticJourneyAward({
    ...args,
    input: {
      ...f.input,
      requestId: randomUUID(),
      assessmentRevision: reassessed.assessment.revision,
    },
  });
  assert.equal(later.outcome.targetPoints, 0);
  assert.equal(later.entry.delta, 0);
  assert.equal(later.outcome.cumulativeAutomaticCredit, 120);
  assert.equal(
    (await readPointsHistory(pool, f.token, f.profile.id)).balance,
    120,
  );
  assert.deepEqual(await settleSyntheticJourneyAward(args), first);
  const anotherConnection = createDatabase();
  try {
    assert.equal(
      (await readJourneyAward({ ...args, pool: anotherConnection }))
        .cumulativeAutomaticCredit,
      120,
    );
    assert.deepEqual(
      await settleSyntheticJourneyAward({ ...args, pool: anotherConnection }),
      first,
    );
  } finally {
    await anotherConnection.end();
  }
});

test('a prepared journey cannot settle before Start or pin an unfinished earning basis', async () => {
  const f = await fixture();
  const prepared = await f.journeys.prepare(
    f.token,
    { profileId: f.profile.id, requestId: randomUUID() },
    awardRoute(),
  );
  const args = {
    pool,
    token: f.token,
    journeyId: prepared.id,
    input: {
      profileId: f.profile.id,
      requestId: randomUUID(),
      assessmentVersion: prepared.assessment.version,
      assessmentRevision: prepared.assessment.revision,
    },
  };
  await assert.rejects(settleSyntheticJourneyAward(args), { status: 409 });
  assert.equal((await readJourneyAward(args)).latestReceipt, null);
});
