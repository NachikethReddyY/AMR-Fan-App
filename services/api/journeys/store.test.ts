import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { testDatabaseName } from '../../../scripts/local-db.mjs';
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
    `/${testDatabaseName()}`
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
  assert.ok('kgCo2ePerPassengerKm' in prepared.basis.calculation.factors[0]);
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

test('settlement projection uses the caller transaction, keeps nonprecise inputs after expiry, and separates assessment revisions', async () => {
  const { lockJourneyForSettlement } = await import('./settlement.ts');
  const account = await ensureAccount(pool, { issuer, subject: 'a' });
  let now = Date.now();
  const service = createJourneyService({ pool, env, clock: () => now });
  const route = routeFixture(now);
  const prepared = await service.prepare(
    token,
    { profileId, requestId: randomUUID() },
    route,
  );
  const captureSessionId = randomUUID();
  const active = await service.start(token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
  });
  const startTime = now;
  now += 60000;
  const recorded = await service.appendEvidence(token, active.id, {
    requestId: randomUUID(),
    captureSessionId,
    samples: [route.start, route.end].map((point, index) => ({
      ...point,
      id: randomUUID(),
      acquiredAtMs: startTime + index * 60000,
      receivedAtMs: now,
      accuracyMeters: 1,
      context: 'foreground',
      mocked: false,
    })),
  });
  const finished = await service.finish(token, active.id, {
    requestId: randomUUID(),
    captureSessionId,
    endedAtMs: now,
    reason: 'arrival',
  });
  assert.equal(finished.assessment.status, 'satisfies_configured_rules');
  assert.ok(finished.assessment.revision > recorded.assessment.revision);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const projection = await lockJourneyForSettlement(
      client,
      account.id,
      profileId,
      active.id,
    );
    assert.equal(
      projection.earningPolicy?.arithmeticVersion,
      'floor-decimal-v1',
    );
    assert.equal(projection.earningPolicy?.pointsPerKg, 50);
    assert.equal(projection.earningPolicy?.journeyCap, 2000);
    assert.deepEqual(projection.selectedLegs, [
      { mode: 'bus', distanceMeters: 1112, durationSeconds: 300 },
    ]);
    assert.equal(projection.assessedLegs.kind, 'available');
    assert.equal(
      projection.assessmentIdentity.revision,
      finished.assessment.revision,
    );
    assert.equal(projection.assessment.calibration, 'unvalidated');
    assert.ok(
      !/latitude|longitude|points"|geometry/.test(JSON.stringify(projection)),
    );
    await client.query('COMMIT');
    now = prepared.preciseExpiresAtMs;
    await service.cleanup();
    await client.query('BEGIN');
    assert.deepEqual(
      await lockJourneyForSettlement(client, account.id, profileId, active.id),
      projection,
    );
    await assert.rejects(
      lockJourneyForSettlement(client, randomUUID(), profileId, active.id),
      { status: 404 },
    );
    await client.query('ROLLBACK');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('multimodal evidence cannot fabricate assessed leg distances and duplicate samples preserve assessment identity', async () => {
  let now = Date.now();
  const service = createJourneyService({ pool, env, clock: () => now });
  const route = routeFixture(now);
  route.legs = [
    { mode: 'walk', distanceMeters: 100, durationSeconds: 100 },
    { mode: 'bus', distanceMeters: 1012, durationSeconds: 200 },
  ];
  const prepared = await service.prepare(
    token,
    { profileId, requestId: randomUUID() },
    route,
  );
  const captureSessionId = randomUUID();
  await service.start(token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
  });
  const startTime = now;
  now += 60000;
  const batch = {
    requestId: randomUUID(),
    captureSessionId,
    samples: [route.start, route.end].map((point, index) => ({
      ...point,
      id: randomUUID(),
      acquiredAtMs: startTime + index * 60000,
      receivedAtMs: now,
      accuracyMeters: 1,
      context: 'foreground',
      mocked: false,
    })),
  };
  await service.appendEvidence(token, prepared.id, batch);
  const finished = await service.finish(token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
    endedAtMs: now,
    reason: 'arrival',
  });
  assert.equal(finished.assessment.status, 'satisfies_configured_rules');
  assert.deepEqual(finished.assessedLegs, {
    kind: 'unavailable',
    reason: 'multimodal_distances_unknown',
  });
  const repeated = await service.appendEvidence(token, prepared.id, {
    ...batch,
    requestId: randomUUID(),
  });
  assert.deepEqual(repeated.assessment, finished.assessment);
});

test('old preparation receipt replays without display enrichment or provider spend and its ID still starts', async () => {
  const account = await ensureAccount(pool, { issuer, subject: 'a' });
  const prepared = await journeys.prepare(
    token,
    { profileId, requestId: randomUUID() },
    routeFixture(),
  );
  const input = {
    profileId,
    requestId: randomUUID(),
    query: {
      origin: 'Legacy origin',
      destination: 'Legacy destination',
      modes: ['WALK'],
      extraMinutes: 0,
    },
  };
  const legacy = {
    kind: 'prepared',
    candidates: [
      { kind: 'prepared', routeId: 'legacy-route', journey: prepared },
    ],
  };
  await pool.query(
    'INSERT INTO app.journey_plans(principal_id,request_id,profile_id,fingerprint,result) VALUES ($1,$2,$3,$4,$5)',
    [
      account.id,
      input.requestId,
      profileId,
      createHash('sha256')
        .update(JSON.stringify({ action: 'plan', input }))
        .digest('hex'),
      legacy,
    ],
  );
  const service = createJourneyService({
    pool,
    env,
    queryRoutes: async () => {
      assert.fail('Legacy replay must not reacquire comparison');
    },
  });
  assert.deepEqual(await service.preparePlan(token, input), legacy);
  const start = { requestId: randomUUID(), captureSessionId: randomUUID() };
  const active = await service.start(token, prepared.id, start);
  assert.equal(active.id, prepared.id);
  assert.equal(active.state, 'active');
  assert.deepEqual(await service.start(token, prepared.id, start), active);
  assert.deepEqual(await service.preparePlan(token, input), legacy);
  await assert.rejects(
    service.preparePlan(token, {
      ...input,
      query: { ...input.query, extraMinutes: 1 },
    }),
    { status: 409 },
  );
});

test('discovery pages multiple active journeys after reconnect without local IDs or read-side writes', async (t) => {
  const account = await ensureAccount(pool, { issuer, subject: 'discovery' });
  const profile = account.profiles.find((p) => p.kind === 'real');
  assert.ok(profile);
  const auth = (await createSession(pool, account.id)).token;
  let now = Date.now();
  const service = createJourneyService({ pool, env, clock: () => now });
  const prepared = [];
  for (let i = 0; i < 3; i++)
    prepared.push(
      await service.prepare(
        auth,
        { profileId: profile.id, requestId: randomUUID() },
        routeFixture(now),
      ),
    );
  const active = [];
  for (const item of prepared.slice(0, 2))
    active.push(
      await service.start(auth, item.id, {
        requestId: randomUUID(),
        captureSessionId: randomUUID(),
      }),
    );
  now += 8 * 86400000;
  // Listing expired rows must not run the detail-read cleanup or rewrite assessments.
  const before = (
    await pool.query(
      'SELECT id, summary, snapshot, precise_expires_at FROM app.journeys WHERE profile_id=$1 ORDER BY id',
      [profile.id],
    )
  ).rows;
  const reconnected = createDatabase();
  try {
    const restored = createJourneyService({
      pool: reconnected,
      env,
      clock: () => now,
    });
    const page = await restored.listOwned(auth, profile.id, {
      state: 'active',
      limit: '1',
    });
    assert.equal(page.items.length, 1);
    assert.equal(page.asOfMs, now);
    assert.ok(page.nextCursor);
    const next = await restored.listOwned(auth, profile.id, {
      state: 'active',
      limit: 1,
      before: page.nextCursor,
    });
    assert.equal(next.nextCursor, null);
    const expected = active
      .map((item) => item.id)
      .sort()
      .reverse();
    assert.deepEqual(
      [...page.items, ...next.items].map((item) => item.id),
      expected,
    );
    assert.ok(page.items[0].preciseExpiresAtMs < page.asOfMs);
    assert.equal(page.items[0].assessment.status, 'unfinished');
    assert.equal(page.items[0].assessment.calibration, 'unvalidated');
    assert.doesNotMatch(
      JSON.stringify(page),
      /latitude|longitude|snapshot|factor|captureSessionId|selectedLegs/,
    );
    const recent = await restored.listOwned(auth, profile.id);
    assert.deepEqual(
      recent.items.map((item) => item.id),
      prepared
        .map((item) => item.id)
        .sort()
        .reverse(),
    );
    assert.deepEqual(
      (
        await pool.query(
          'SELECT id, summary, snapshot, precise_expires_at FROM app.journeys WHERE profile_id=$1 ORDER BY id',
          [profile.id],
        )
      ).rows,
      before,
    );
    const discovered = await restored.read(auth, page.items[0].id);
    assert.equal(
      discovered.captureSessionId,
      active.find((item) => item.id === discovered.id)?.captureSessionId,
    );
    assert.equal(discovered.state, 'active');
    t.diagnostic(
      JSON.stringify({
        activeDiscovered: 2,
        recentDiscovered: 3,
        noListWrites: true,
      }),
    );
  } finally {
    await reconnected.end();
  }
});

test('discovery enforces current owner/session, strict bounds and profile/view cursor binding', async () => {
  const owner = await ensureAccount(pool, {
    issuer,
    subject: 'discovery-auth',
  });
  const other = await ensureAccount(pool, {
    issuer,
    subject: 'discovery-foreign-admin',
  });
  const profile = owner.profiles.find((p) => p.kind === 'real');
  const demo = owner.profiles.find((p) => p.kind === 'demo');
  const foreignProfile = other.profiles.find((p) => p.kind === 'real');
  assert.ok(profile && demo && foreignProfile);
  await pool.query("UPDATE app.principals SET role='admin' WHERE id=$1", [
    other.id,
  ]);
  const auth = (await createSession(pool, owner.id)).token;
  const foreign = (await createSession(pool, other.id)).token;
  for (let i = 0; i < 22; i++)
    await journeys.prepare(
      auth,
      { profileId: profile.id, requestId: randomUUID() },
      routeFixture(),
    );
  assert.equal((await journeys.listOwned(auth, profile.id)).items.length, 20);
  assert.equal(
    (await journeys.listOwned(auth, profile.id, { limit: '50' })).items.length,
    22,
  );
  assert.deepEqual((await journeys.listOwned(auth, demo.id)).items, []);
  await assert.rejects(journeys.listOwned('', profile.id), { status: 401 });
  await assert.rejects(journeys.listOwned(foreign, profile.id), {
    status: 404,
  });
  await assert.rejects(journeys.listOwned(auth, foreignProfile.id), {
    status: 404,
  });
  await assert.rejects(journeys.listOwned(auth, randomUUID()), { status: 404 });
  for (const raw of [
    { state: 'finished' },
    { owner: owner.id },
    { limit: 0 },
    { limit: 51 },
    { limit: 1.5 },
    { limit: true },
    { limit: '01' },
    { limit: '1e1' },
    { limit: ' 2' },
    { limit: ['2'] },
    { before: '' },
    { before: 'a'.repeat(513) },
    { before: 'invalid-json' },
    { before: Buffer.from('{}').toString('base64url') },
  ])
    await assert.rejects(journeys.listOwned(auth, profile.id, raw), {
      status: 400,
    });
  const first = await journeys.listOwned(auth, profile.id, { limit: 1 });
  assert.ok(first.nextCursor);
  await assert.rejects(
    journeys.listOwned(auth, profile.id, {
      state: 'active',
      before: first.nextCursor,
    }),
    { status: 400 },
  );
  await assert.rejects(
    journeys.listOwned(auth, demo.id, { before: first.nextCursor }),
    { status: 400 },
  );
  const cursor = JSON.parse(
    Buffer.from(first.nextCursor, 'base64url').toString('utf8'),
  );
  for (const altered of [
    { ...cursor, version: 2 },
    { ...cursor, preparedAtMs: -1 },
    { ...cursor, extra: true },
  ])
    await assert.rejects(
      journeys.listOwned(auth, profile.id, {
        before: Buffer.from(JSON.stringify(altered)).toString('base64url'),
      }),
      { status: 400 },
    );
  const revoked = await createSession(pool, owner.id);
  await pool.query(
    'UPDATE app.sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1',
    [createHash('sha256').update(revoked.token).digest('hex')],
  );
  await assert.rejects(journeys.listOwned(revoked.token, profile.id), {
    status: 401,
  });
  const expired = await createSession(pool, owner.id);
  await pool.query(
    "UPDATE app.sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1",
    [createHash('sha256').update(expired.token).digest('hex')],
  );
  await assert.rejects(journeys.listOwned(expired.token, profile.id), {
    status: 401,
  });
});

test('discovery keyset keeps tied preparations stable while newer rows arrive and finish remains authoritative', async () => {
  const account = await ensureAccount(pool, {
    issuer,
    subject: 'discovery-order',
  });
  const profile = account.profiles.find((p) => p.kind === 'real');
  assert.ok(profile);
  const auth = (await createSession(pool, account.id)).token;
  let now = Date.now();
  const service = createJourneyService({ pool, env, clock: () => now });
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const prepared = await service.prepare(
      auth,
      { profileId: profile.id, requestId: randomUUID() },
      routeFixture(now),
    );
    rows.push(
      await service.start(auth, prepared.id, {
        requestId: randomUUID(),
        captureSessionId: randomUUID(),
      }),
    );
  }
  const first = await service.listOwned(auth, profile.id, { limit: 2 });
  assert.ok(first.nextCursor);
  now++;
  const newer = await service.prepare(
    auth,
    { profileId: profile.id, requestId: randomUUID() },
    routeFixture(now),
  );
  const ids = first.items.map((item) => item.id);
  let before: string | null = first.nextCursor;
  while (before) {
    const page = await service.listOwned(auth, profile.id, {
      limit: 2,
      before,
    });
    ids.push(...page.items.map((item) => item.id));
    before = page.nextCursor;
  }
  assert.deepEqual(
    ids,
    rows
      .map((item) => item.id)
      .sort()
      .reverse(),
  );
  assert.equal(
    (await service.listOwned(auth, profile.id)).items[0].id,
    newer.id,
  );
  const target = rows[0];
  const [, finished] = await Promise.all([
    service.listOwned(auth, profile.id, { state: 'active' }),
    service.finish(auth, target.id, {
      requestId: randomUUID(),
      captureSessionId: target.captureSessionId,
      endedAtMs: now,
      reason: 'stopped',
    }),
  ]);
  assert.equal((await service.read(auth, target.id)).state, 'finished');
  assert.equal(
    (await service.listOwned(auth, profile.id, { state: 'active' })).items
      .length,
    4,
  );
  const current = (await service.listOwned(auth, profile.id)).items.find(
    (item) => item.id === target.id,
  );
  assert.equal(current?.state, 'finished');
  assert.equal(current?.assessment.revision, finished.assessment.revision);
});

test('discovery rejects a session that expires behind an unchanged authority row or owned-profile lock', async () => {
  const account = await ensureAccount(pool, {
    issuer,
    subject: 'discovery-expiry',
  });
  const profile = account.profiles.find((p) => p.kind === 'real');
  assert.ok(profile);
  for (const target of ['session', 'profile']) {
    const auth = (await createSession(pool, account.id)).token;
    const hash = createHash('sha256').update(auth).digest('hex');
    const lock = await pool.connect();
    let pending: Promise<void> | undefined;
    try {
      await pool.query(
        "UPDATE app.sessions SET expires_at=clock_timestamp()+interval '1 second' WHERE token_hash=$1",
        [hash],
      );
      await lock.query('BEGIN');
      const blocker = await lock.query<{ pid: number }>(
        'SELECT pg_backend_pid() AS pid',
      );
      if (target === 'session')
        await lock.query(
          'SELECT token_hash FROM app.sessions WHERE token_hash=$1 FOR UPDATE',
          [hash],
        );
      else
        await lock.query('SELECT id FROM app.profiles WHERE id=$1 FOR UPDATE', [
          profile.id,
        ]);
      pending = assert.rejects(journeys.listOwned(auth, profile.id), {
        status: 401,
      });
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        const result = await pool.query(
          'SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))',
          [blocker.rows[0].pid],
        );
        if (result.rowCount) {
          waiting = true;
          break;
        }
        await pool.query('SELECT pg_sleep(0.01)');
      }
      assert.ok(waiting, `discovery waits on ${target} lock`);
      await lock.query(
        'SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM (expires_at-clock_timestamp())))+0.05) FROM app.sessions WHERE token_hash=$1',
        [hash],
      );
      await lock.query('COMMIT');
      await pending;
    } finally {
      await lock.query('ROLLBACK');
      lock.release();
      await pending;
    }
  }
});
