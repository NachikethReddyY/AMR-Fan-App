import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { namespaceFor } from '../../scripts/local-db.mjs';
import { after, before, test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';
import { createJourneyService } from './store.ts';
import { routeFixture } from './fixtures.ts';
import { candidatePolicy } from './contracts.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${namespaceFor(fileURLToPath(new URL('../../', import.meta.url)))}_test`
) {
  throw new Error('Use only the allocated journey worktree test database.');
}
const pool = createDatabase();
const env = { NODE_ENV: 'test', JOURNEY_FIXTURES_ENABLED: 'true' };
const journeys = createJourneyService({ pool, env });
const issuer = `urn:amr:journey-test:${randomUUID()}`;
let token = '';
let profileId = '';
before(async () => {
  await migrate(pool);
  const account = await ensureAccount(pool, { issuer, subject: 'a' });
  const profile = account.profiles.find((p) => p.kind === 'real');
  assert.ok(profile);
  profileId = profile.id;
  token = (await createSession(pool, account.id)).token;
});
after(async () => {
  await pool.query('DELETE FROM app.principals WHERE issuer = $1', [issuer]);
  await pool.end();
});

test('owner prepares an immutable server route and reads the same prepared journey after reconnecting', async () => {
  const result = await journeys.prepare(
    token,
    { profileId, requestId: randomUUID() },
    routeFixture(),
  );
  assert.equal(result.state, 'prepared');
  assert.equal(result.profileId, profileId);
  assert.equal(result.source.kind, 'fixture');
  const reconnected = createDatabase();
  try {
    assert.deepEqual(
      await createJourneyService({ pool: reconnected, env }).read(
        token,
        result.id,
      ),
      result,
    );
  } finally {
    await reconnected.end();
  }
});

test('prepare/start retries are stable, changed requests conflict, and foreign or revoked sessions cannot access journeys', async () => {
  const route = routeFixture();
  const input = { profileId, requestId: randomUUID() };
  const [one, repeated] = await Promise.all([
    journeys.prepare(token, input, route),
    journeys.prepare(token, input, route),
  ]);
  assert.deepEqual(repeated, one);
  await assert.rejects(
    journeys.prepare(token, input, { ...route, routeId: 'changed' }),
    { status: 409 },
  );
  const other = await ensureAccount(pool, { issuer, subject: 'b' });
  const otherToken = (await createSession(pool, other.id)).token;
  await assert.rejects(journeys.read(otherToken, one.id), { status: 404 });
  await assert.rejects(
    journeys.prepare(otherToken, { profileId, requestId: randomUUID() }, route),
    { status: 404 },
  );
  await assert.rejects(journeys.read('invalid', one.id), { status: 401 });
  const start = { requestId: randomUUID(), captureSessionId: randomUUID() };
  const active = await journeys.start(token, one.id, start);
  assert.equal(active.state, 'active');
  assert.deepEqual(await journeys.start(token, one.id, start), active);
  await assert.rejects(
    journeys.start(token, one.id, { ...start, captureSessionId: randomUUID() }),
    { status: 409 },
  );
  await assert.rejects(
    journeys.start(token, one.id, { ...start, requestId: randomUUID() }),
    { status: 409 },
  );
  const temporary = await createSession(pool, other.id);
  await pool.query(
    'UPDATE app.sessions SET revoked_at = now() WHERE principal_id = $1',
    [other.id],
  );
  await assert.rejects(journeys.read(temporary.token, one.id), { status: 401 });
  await assert.rejects(
    journeys.prepare(
      token,
      { ...input, requestId: randomUUID(), geometry: route.points },
      route,
    ),
    { status: 400 },
  );
});

test('offline evidence and finish race converge on one assessment; repeated batches do not duplicate samples', async () => {
  let now = Date.now();
  const service = createJourneyService({ pool, env, clock: () => now });
  const prepared = await service.prepare(
    token,
    { profileId, requestId: randomUUID() },
    routeFixture(now),
  );
  const captureSessionId = randomUUID();
  const active = await service.start(token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
  });
  assert.ok(active.startedAtMs);
  const began = active.startedAtMs;
  const samples = [0, 90, 180, 300].map((seconds, i) => ({
    id: randomUUID(),
    acquiredAtMs: began + seconds * 1000,
    receivedAtMs: began + seconds * 1000,
    latitude: [1.3, 1.303, 1.306, 1.31][i],
    longitude: 103.8,
    accuracyMeters: 5,
    context: 'background',
    mocked: null,
  }));
  now += 400000;
  const batch = {
    requestId: randomUUID(),
    captureSessionId,
    samples: [...samples].reverse(),
  };
  const finish = {
    requestId: randomUUID(),
    captureSessionId,
    endedAtMs: began + 300000,
    reason: 'arrival',
  };
  const [evidenceReceipt, finishReceipt] = await Promise.all([
    service.appendEvidence(token, active.id, batch),
    service.finish(token, active.id, finish),
  ]);
  const current = await service.read(token, active.id);
  assert.equal(current.state, 'finished');
  assert.equal(current.assessment.status, 'satisfies_configured_rules');
  assert.equal(current.assessment.sampleCount, 4);
  assert.equal(current.assessment.elapsedMs, 300000);
  assert.deepEqual(
    await service.appendEvidence(token, active.id, batch),
    evidenceReceipt,
  );
  assert.deepEqual(
    await service.finish(token, active.id, finish),
    finishReceipt,
  );
  const duplicate = await service.appendEvidence(token, active.id, {
    ...batch,
    requestId: randomUUID(),
  });
  assert.equal(duplicate.evidenceRevision, current.evidenceRevision);
  assert.equal(duplicate.assessment.sampleCount, 4);
  await assert.rejects(
    service.appendEvidence(token, active.id, {
      ...batch,
      requestId: randomUUID(),
      samples: [{ ...samples[0], latitude: 1.301 }],
    }),
    { status: 409 },
  );
  await assert.rejects(
    service.appendEvidence(token, active.id, {
      ...batch,
      requestId: randomUUID(),
      samples: [
        {
          ...samples[0],
          id: randomUUID(),
          acquiredAtMs: began + 301000,
          receivedAtMs: now,
        },
      ],
    }),
    { status: 409 },
  );
  await assert.rejects(
    service.finish(token, active.id, {
      ...finish,
      requestId: randomUUID(),
      reason: 'stopped',
    }),
    { status: 409 },
  );
  assert.equal(
    (await service.read(token, active.id)).assessment.sampleCount,
    4,
  );
});

test('seven-day cleanup removes precise snapshots and raw samples but preserves summaries and replay outcomes', async () => {
  let now = Date.now();
  const service = createJourneyService({ pool, env, clock: () => now });
  const acquired = now;
  const prepareInput = { profileId, requestId: randomUUID() };
  const route = routeFixture(now);
  const prepared = await service.prepare(token, prepareInput, route);
  const startInput = {
    requestId: randomUUID(),
    captureSessionId: randomUUID(),
  };
  const active = await service.start(token, prepared.id, startInput);
  const batch = {
    requestId: randomUUID(),
    captureSessionId: startInput.captureSessionId,
    samples: [
      {
        id: randomUUID(),
        acquiredAtMs: now,
        receivedAtMs: now,
        latitude: 1.3,
        longitude: 103.8,
        accuracyMeters: 5,
        mocked: null,
        context: 'foreground',
      },
    ],
  };
  const receipt = await service.appendEvidence(token, active.id, batch);
  now = acquired + 7 * 86400000 - 1;
  await service.cleanup();
  assert.equal(
    (
      await pool.query(
        'SELECT snapshot IS NOT NULL AS retained FROM app.journeys WHERE id = $1',
        [active.id],
      )
    ).rows[0].retained,
    true,
  );
  const newer = await service.prepare(
    token,
    { profileId, requestId: randomUUID() },
    routeFixture(now),
  );
  now++;
  const before = await service.read(token, active.id);
  assert.equal(before.assessment.sampleCount, 1);
  const precise = await pool.query(
    'SELECT snapshot FROM app.journeys WHERE id = $1',
    [active.id],
  );
  assert.equal(precise.rows[0].snapshot, null);
  const count = await pool.query(
    'SELECT count(*)::int AS count FROM app.journey_samples WHERE journey_id = $1',
    [active.id],
  );
  assert.equal(count.rows[0].count, 0);
  assert.deepEqual(
    await service.appendEvidence(token, active.id, batch),
    receipt,
  );
  assert.deepEqual(await service.prepare(token, prepareInput, route), prepared);
  assert.deepEqual(await service.start(token, active.id, startInput), active);
  await assert.rejects(
    service.appendEvidence(token, active.id, {
      ...batch,
      requestId: randomUUID(),
    }),
    { status: 409 },
  );
  assert.equal((await service.read(token, newer.id)).state, 'prepared');
  assert.deepEqual(await service.cleanup(), { journeys: 0, samples: 0 });
  assert.equal(
    (
      await pool.query(
        'SELECT snapshot IS NOT NULL AS retained FROM app.journeys WHERE id = $1',
        [newer.id],
      )
    ).rows[0].retained,
    true,
  );
});

test('invalid or partially conflicting batches roll back, SQL mutation cannot rewrite evidence, and stopped journeys accept only older delayed evidence', async () => {
  let now = Date.now();
  const service = createJourneyService({ pool, env, clock: () => now });
  const prepared = await service.prepare(
    token,
    { profileId, requestId: randomUUID() },
    routeFixture(now),
  );
  const captureSessionId = randomUUID();
  const active = await service.start(token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
  });
  const sample = {
    id: randomUUID(),
    acquiredAtMs: now,
    receivedAtMs: now,
    latitude: 1.3,
    longitude: 103.8,
    accuracyMeters: 5,
    context: 'foreground',
    mocked: null,
  };
  const batch = {
    requestId: randomUUID(),
    captureSessionId,
    samples: [sample],
  };
  await service.appendEvidence(token, active.id, batch);
  now += 10000;
  for (const invalid of [
    { ...sample, latitude: NaN },
    { ...sample, longitude: 181 },
    { ...sample, accuracyMeters: -1 },
    { ...sample, extra: 'untrusted' },
  ])
    await assert.rejects(
      service.appendEvidence(token, active.id, {
        ...batch,
        requestId: randomUUID(),
        samples: [invalid],
      }),
      { status: 400 },
    );
  await assert.rejects(
    service.appendEvidence(token, active.id, {
      ...batch,
      requestId: randomUUID(),
      samples: Array.from({ length: 101 }, () => sample),
    }),
    { status: 400 },
  );
  for (const invalid of [
    {
      ...sample,
      id: randomUUID(),
      acquiredAtMs: now + 1,
      receivedAtMs: now + 1,
    },
    { ...sample, id: randomUUID(), receivedAtMs: sample.acquiredAtMs - 1 },
  ])
    await assert.rejects(
      service.appendEvidence(token, active.id, {
        ...batch,
        requestId: randomUUID(),
        samples: [invalid],
      }),
      { status: 409 },
    );
  const requestId = randomUUID();
  const delayed = {
    ...sample,
    id: randomUUID(),
    acquiredAtMs: now - 5000,
    receivedAtMs: now,
  };
  await assert.rejects(
    service.appendEvidence(token, active.id, {
      ...batch,
      requestId,
      samples: [delayed, { ...sample, latitude: 1.4 }],
    }),
    { status: 409 },
  );
  assert.equal(
    (await service.read(token, active.id)).assessment.sampleCount,
    1,
  );
  // The rejected request did not retain a successful receipt or a partial sample.
  assert.equal(
    (
      await service.appendEvidence(token, active.id, {
        ...batch,
        requestId,
        samples: [delayed],
      })
    ).assessment.sampleCount,
    2,
  );
  await assert.rejects(
    pool.query(
      "UPDATE app.journey_samples SET sample = '{}' WHERE journey_id = $1",
      [active.id],
    ),
    /append-only/,
  );
  await assert.rejects(
    pool.query("UPDATE app.journeys SET snapshot = '{}' WHERE id = $1", [
      active.id,
    ]),
    /immutable/,
  );
  const stopped = await service.finish(token, active.id, {
    requestId: randomUUID(),
    captureSessionId,
    endedAtMs: now,
    reason: 'stopped',
  });
  assert.equal(stopped.assessment.status, 'insufficient_evidence');
  assert.ok(stopped.assessment.reasons.includes('not_arrived'));
  now += 10000;
  const result = await service.appendEvidence(token, active.id, {
    ...batch,
    requestId: randomUUID(),
    samples: [{ ...delayed, id: randomUUID() }],
  });
  assert.equal(result.state, 'finished');
  assert.equal(result.finishReason, 'stopped');
});

test('fixture configuration fails closed in production; current sessions and real-profile ownership remain required', async () => {
  assert.throws(
    () =>
      createJourneyService({
        pool,
        env: { NODE_ENV: 'production', JOURNEY_FIXTURES_ENABLED: 'true' },
      }),
    /disabled in production/,
  );
  const disabled = createJourneyService({ pool, env: { NODE_ENV: 'test' } });
  await assert.rejects(
    disabled.prepare(
      token,
      { profileId, requestId: randomUUID() },
      routeFixture(),
    ),
    { status: 403 },
  );
  const account = await ensureAccount(pool, { issuer, subject: 'a' });
  const demo = account.profiles.find((p) => p.kind === 'demo');
  assert.ok(demo);
  await assert.rejects(
    journeys.prepare(
      token,
      { profileId: demo.id, requestId: randomUUID() },
      routeFixture(),
    ),
    { status: 409 },
  );
  await assert.rejects(
    journeys.prepare(
      token,
      { profileId, requestId: randomUUID() },
      { ...routeFixture(), points: [] },
    ),
    { status: 400 },
  );
  const expired = await createSession(pool, account.id);
  await pool.query(
    "UPDATE app.sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1",
    [createHash('sha256').update(expired.token).digest('hex')],
  );
  await assert.rejects(
    journeys.prepare(
      expired.token,
      { profileId, requestId: randomUUID() },
      routeFixture(),
    ),
    { status: 401 },
  );
});

test('latest-session validation survives lock waits and assessment policy changes do not rewrite an active journey', async () => {
  const account = await ensureAccount(pool, { issuer, subject: 'a' });
  const short = await createSession(pool, account.id);
  const shortHash = createHash('sha256').update(short.token).digest('hex');
  await pool.query(
    "UPDATE app.sessions SET expires_at = now() + interval '150 milliseconds' WHERE token_hash = $1",
    [shortHash],
  );
  const lock = await pool.connect();
  try {
    await lock.query('BEGIN');
    await lock.query('SELECT id FROM app.profiles WHERE id = $1 FOR UPDATE', [
      profileId,
    ]);
    const waiting = journeys.prepare(
      short.token,
      { profileId, requestId: randomUUID() },
      routeFixture(),
    );
    const assertion = assert.rejects(waiting, { status: 401 });
    await lock.query('SELECT pg_sleep(0.25)');
    await lock.query('COMMIT');
    await assertion;
  } finally {
    await lock.query('ROLLBACK');
    lock.release();
  }
});

test('a changed evidence configuration takes effect at Start and remains fixed across reconnect and later service changes', async () => {
  const prepared = await journeys.prepare(
    token,
    { profileId, requestId: randomUUID() },
    routeFixture(),
  );
  const next = {
    ...candidatePolicy,
    version: 'journey-calibration-tight-v2',
    accuracyMeters: 25,
  };
  const second = createJourneyService({ pool, env, policy: next });
  const start = { requestId: randomUUID(), captureSessionId: randomUUID() };
  const active = await second.start(token, prepared.id, start);
  assert.match(active.policy.version, /^journey-assessment-v1-[a-f0-9]{32}$/);
  assert.notEqual(active.policy.version, prepared.policy.version);
  assert.equal(active.policy.accuracyMeters, 25);
  assert.deepEqual(
    (await journeys.read(token, active.id)).policy,
    active.policy,
  );
  assert.deepEqual(await journeys.start(token, active.id, start), active);
});

test('the retained calculation basis preserves server factors, rule values and the same-query driving baseline without accepting client amounts', async () => {
  const route = routeFixture();
  const prepared = await journeys.prepare(
    token,
    { profileId, requestId: randomUUID() },
    route,
  );
  assert.equal(prepared.basis.calculation.kind, 'available');
  if (prepared.basis.calculation.kind !== 'available')
    assert.fail('Expected fixture basis.');
  assert.equal(
    prepared.basis.calculation.factors[0].kgCo2ePerPassengerKm,
    0.07,
  );
  assert.equal(prepared.basis.calculation.baseline.distanceMeters, 1500);
  assert.equal(prepared.basis.calculation.earningRule.pointsPerKg, 50);
  route.basis.calculation.factors[0].kgCo2ePerPassengerKm = 999;
  assert.deepEqual(
    (await journeys.read(token, prepared.id)).basis,
    prepared.basis,
  );
  await assert.rejects(
    journeys.prepare(
      token,
      { profileId, requestId: randomUUID(), amount: 500 },
      route,
    ),
    { status: 400 },
  );
});

test('different threshold contents cannot share one retained assessment version even if configuration reuses a label', async () => {
  const prepared = await journeys.prepare(
    token,
    { profileId, requestId: randomUUID() },
    routeFixture(),
  );
  const changed = createJourneyService({
    pool,
    env,
    policy: { ...candidatePolicy, accuracyMeters: 24 },
  });
  const altered = await changed.prepare(
    token,
    { profileId, requestId: randomUUID() },
    routeFixture(),
  );
  assert.notEqual(prepared.policy.version, altered.policy.version);
});

test('bounded batches retain independent server receipt time and refuse a 4097th sample without partial persistence', async (t) => {
  let now = Date.now();
  const acquired = now;
  const service = createJourneyService({ pool, env, clock: () => now });
  const prepared = await service.prepare(
    token,
    { profileId, requestId: randomUUID() },
    routeFixture(now),
  );
  const captureSessionId = randomUUID();
  const active = await service.start(token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
  });
  now += 5000000;
  let last = active;
  const begin = performance.now();
  let inputBytes = 0;
  for (let offset = 0; offset < 4096; offset += 100) {
    const samples = Array.from(
      { length: Math.min(100, 4096 - offset) },
      (_, i) => ({
        id: randomUUID(),
        acquiredAtMs: acquired + (offset + i) * 1000,
        receivedAtMs: acquired + (offset + i) * 1000,
        latitude: 1.3,
        longitude: 103.8,
        accuracyMeters: 5,
        context: 'unknown',
        mocked: null,
      }),
    );
    const batch = { requestId: randomUUID(), captureSessionId, samples };
    inputBytes += Buffer.byteLength(JSON.stringify(batch));
    last = await service.appendEvidence(token, active.id, batch);
  }
  assert.equal(last.assessment.sampleCount, 4096);
  await assert.rejects(
    service.appendEvidence(token, active.id, {
      requestId: randomUUID(),
      captureSessionId,
      samples: [
        {
          id: randomUUID(),
          acquiredAtMs: acquired + 4100000,
          receivedAtMs: now,
          latitude: 1.3,
          longitude: 103.8,
          accuracyMeters: 5,
          context: 'unknown',
          mocked: null,
        },
      ],
    }),
    { status: 413 },
  );
  assert.equal(
    (await service.read(token, active.id)).assessment.sampleCount,
    4096,
  );
  const row = await pool.query(
    'SELECT sample FROM app.journey_samples WHERE journey_id = $1 ORDER BY acquired_at LIMIT 1',
    [active.id],
  );
  assert.equal(row.rows[0].sample.serverReceivedAtMs, now);
  assert.equal(row.rows[0].sample.evidence.acquiredAtMs, acquired);
  t.diagnostic(
    JSON.stringify({
      samples: 4096,
      batches: 41,
      inputBytes,
      elapsedMs: Math.round(performance.now() - begin),
      externalProviderCalls: 0,
    }),
  );
});

test('UUID spelling is canonical across retries and capture/sample ownership', async () => {
  const route = routeFixture();
  const requestId = randomUUID();
  const prepared = await journeys.prepare(
    token,
    { profileId, requestId },
    route,
  );
  assert.deepEqual(
    await journeys.prepare(
      token,
      {
        profileId: profileId.toUpperCase(),
        requestId: requestId.toUpperCase(),
      },
      route,
    ),
    prepared,
  );
  const captureSessionId = randomUUID();
  const input = { requestId: randomUUID(), captureSessionId };
  const active = await journeys.start(token, prepared.id, input);
  assert.deepEqual(
    await journeys.start(token, prepared.id.toUpperCase(), {
      requestId: input.requestId.toUpperCase(),
      captureSessionId: captureSessionId.toUpperCase(),
    }),
    active,
  );
});

test('session expiry is checked after an unchanged session-row wait, before a conflicting replay can run', async () => {
  const account = await ensureAccount(pool, { issuer, subject: 'a' });
  const short = await createSession(pool, account.id);
  const hash = createHash('sha256').update(short.token).digest('hex');
  const route = routeFixture();
  const input = { profileId, requestId: randomUUID() };
  await journeys.prepare(token, input, route);
  const lock = await pool.connect();
  try {
    await pool.query(
      "UPDATE app.sessions SET expires_at = clock_timestamp() + interval '1 second' WHERE token_hash=$1",
      [hash],
    );
    await lock.query('BEGIN');
    const blocker = await lock.query<{ pid: number }>(
      'SELECT pg_backend_pid() AS pid',
    );
    await lock.query(
      'SELECT token_hash FROM app.sessions WHERE token_hash=$1 FOR UPDATE',
      [hash],
    );
    const pending = assert.rejects(
      journeys.prepare(short.token, input, { ...route, routeId: 'changed' }),
      { status: 401 },
    );
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      const rows = await pool.query(
        'SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))',
        [blocker.rows[0].pid],
      );
      if (rows.rowCount) {
        waiting = true;
        break;
      }
      await pool.query('SELECT pg_sleep(0.01)');
    }
    assert.ok(
      waiting,
      'request must actually wait on the unchanged session row',
    );
    await lock.query(
      'SELECT pg_sleep(GREATEST(0, EXTRACT(EPOCH FROM (expires_at-clock_timestamp()))) + 0.05) FROM app.sessions WHERE token_hash=$1',
      [hash],
    );
    await lock.query('COMMIT');
    await pending;
  } finally {
    await lock.query('ROLLBACK');
    lock.release();
  }
});
