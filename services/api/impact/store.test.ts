import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { namespaceFor } from '../../../scripts/local-db.mjs';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount, assignRole } from '../accounts/store.ts';
import { createSession, revokeSession } from '../auth/session.ts';
import { createJourneyService } from '../journeys/store.ts';
import { settleJourneyAward } from '../awards/store.ts';
import { impactRoute } from './testing.ts';
import { awardRoute } from '../awards/testing/fixtures.ts';
import { readContributions } from './store.ts';
import { createApi } from '../api/app.ts';
import { contributionsSchema } from './contracts.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${namespaceFor(fileURLToPath(new URL('../../', import.meta.url)))}_test`
)
  throw new Error('Use only this worktree isolated test database.');
const pool = createDatabase();
const issuer = `urn:amr:impact-test:${randomUUID()}`;
before(() => migrate(pool));
after(() => pool.end());
async function fan() {
  const account = await ensureAccount(pool, { issuer, subject: randomUUID() });
  const profile = account.profiles.find((p) => p.kind === 'real');
  const demo = account.profiles.find((p) => p.kind === 'demo');
  assert.ok(profile && demo);
  return {
    account,
    profile,
    demo,
    token: (await createSession(pool, account.id)).token,
  };
}
async function journey(
  owner: Awaited<ReturnType<typeof fan>>,
  kg: number,
  missing = false,
  fixture = false,
  legacy = false,
) {
  let now = Date.now();
  const service = createJourneyService({
    pool,
    env: { NODE_ENV: 'test', JOURNEY_FIXTURES_ENABLED: 'true' },
    clock: () => now,
  });
  const route = legacy ? awardRoute(kg, now) : impactRoute(kg, now);
  // Controlled fixtures exercise configured eligibility, never claim actual travel.
  if (!fixture)
    route.source = { kind: 'live', provider: 'synthetic-impact-policy-test' };
  route.basis.factorStatus = 'approved';
  assert.equal(route.basis.calculation.kind, 'available');
  if (route.basis.calculation.kind === 'available')
    route.basis.calculation.factors.forEach((f) => {
      f.status = 'approved';
    });
  const prepared = await service.prepare(
    owner.token,
    { profileId: owner.profile.id, requestId: randomUUID() },
    route,
  );
  const captureSessionId = randomUUID();
  await service.start(owner.token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
  });
  const samples = Array.from({ length: 6 }, (_, i) => ({
    id: randomUUID(),
    acquiredAtMs: now + i * 60000,
    receivedAtMs: now + i * 60000,
    latitude: 1.3 + i * 0.002,
    longitude: 103.8,
    accuracyMeters: 5,
    context: 'background',
    mocked: false,
  }));
  now += 300000;
  await service.appendEvidence(owner.token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
    samples: missing ? [samples[0], samples[5]] : samples,
  });
  const finished = await service.finish(owner.token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
    endedAtMs: now,
    reason: 'arrival',
  });
  const args = {
    pool,
    token: owner.token,
    journeyId: prepared.id,
    input: {
      profileId: owner.profile.id,
      requestId: randomUUID(),
      assessmentVersion: finished.assessment.version,
      assessmentRevision: finished.assessment.revision,
    },
  };
  await settleJourneyAward(args);
  return {
    args,
    service,
    captureSessionId,
    samples,
    advance: () => {
      now += 1000;
    },
  };
}

test('real DB: owned empty, admin privacy, demo exclusion, expiry and anonymous HTTP', async () => {
  const a = await fan();
  const b = await fan();
  const empty = await readContributions({
    pool,
    token: a.token,
    profileId: a.profile.id,
  });
  assert.deepEqual(empty.personal, { kind: 'empty' });
  assert.deepEqual(
    (await readContributions({ pool, token: a.token, profileId: a.demo.id }))
      .personal,
    { kind: 'unavailable', reasons: ['demo_profile'] },
  );
  await assert.rejects(
    readContributions({ pool, token: b.token, profileId: a.profile.id }),
    { status: 404 },
  );
  await assignRole(
    pool,
    b.account.id,
    'admin',
    'Synthetic impact privacy proof',
  );
  await assert.rejects(
    readContributions({ pool, token: b.token, profileId: a.profile.id }),
    { status: 404 },
  );
  const server = createApi({
    pool,
    env: { NODE_ENV: 'test', AUTH_DEV_ENABLED: 'true', API_HOST: '127.0.0.1' },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/v1/profiles/${a.profile.id}/impact`;
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${a.token}` },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = contributionsSchema.parse(await response.json());
    assert.deepEqual(result.personal, { kind: 'empty' });
    assert.ok(!JSON.stringify(result).includes(a.profile.id));
    await revokeSession(pool, a.token);
    assert.equal(
      (await fetch(url, { headers: { Authorization: `Bearer ${a.token}` } }))
        .status,
      401,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('real DB: configured estimate policy sums 2+3/4 once through replay and evidence upgrade; reads preserve credit and separate CO2 from legacy units', async () => {
  const a = await fan();
  const b = await fan();
  const first = await journey(a, 2);
  const second = await journey(a, 3, true);
  await journey(b, 4);
  await journey(a, 99, false, true);
  const read = () =>
    readContributions({
      pool,
      token: a.token,
      profileId: a.profile.id,
      policy: 'allow_unvalidated_estimates',
    });
  const before = await read();
  assert.equal(before.personal.kind, 'available');
  if (before.personal.kind === 'available')
    assert.equal(before.personal.savingsKg, '2');
  await settleJourneyAward(first.args);
  first.advance();
  const reassessed = await first.service.appendEvidence(
    a.token,
    first.args.journeyId,
    {
      requestId: randomUUID(),
      captureSessionId: first.captureSessionId,
      samples: [
        {
          ...first.samples[0],
          id: randomUUID(),
          acquiredAtMs: first.samples[0].acquiredAtMs + 30000,
          receivedAtMs: first.samples[0].receivedAtMs + 30000,
          latitude: 1.301,
        },
      ],
    },
  );
  assert.ok(
    reassessed.assessment.revision > first.args.input.assessmentRevision,
  );
  const pending = await read();
  assert.deepEqual(pending.personal, {
    kind: 'unavailable',
    reasons: ['assessment_pending', 'insufficient_evidence'],
  });
  assert.deepEqual(pending.community, {
    kind: 'available',
    savingsKg: '4',
    journeyCount: 1,
    excludedJourneys: 2,
  });
  // Repeated reads cannot settle the pending assessment.
  assert.deepEqual((await read()).personal, pending.personal);
  await settleJourneyAward({
    ...first.args,
    input: {
      ...first.args.input,
      requestId: randomUUID(),
      assessmentVersion: reassessed.assessment.version,
      assessmentRevision: reassessed.assessment.revision,
    },
  });
  assert.deepEqual((await read()).personal, {
    kind: 'available',
    savingsKg: '2',
    journeyCount: 1,
    excludedJourneys: 1,
  });
  second.advance();
  const updated = await second.service.appendEvidence(
    a.token,
    second.args.journeyId,
    {
      requestId: randomUUID(),
      captureSessionId: second.captureSessionId,
      samples: second.samples.slice(1, 5),
    },
  );
  await settleJourneyAward({
    ...second.args,
    input: {
      ...second.args.input,
      requestId: randomUUID(),
      assessmentRevision: updated.assessment.revision,
    },
  });
  const balanceBeforeRead = await pool.query(
    'SELECT balance FROM app.profiles WHERE id=$1',
    [a.profile.id],
  );
  const after = await read();
  assert.deepEqual(after.personal, {
    kind: 'available',
    savingsKg: '5',
    journeyCount: 2,
    excludedJourneys: 0,
  });
  assert.deepEqual(after.community, {
    kind: 'available',
    savingsKg: '9',
    journeyCount: 3,
    excludedJourneys: 0,
  });
  assert.ok(after.sources.length > 0);
  assert.ok(!JSON.stringify(after).includes(first.args.journeyId));
  assert.deepEqual(
    (await readContributions({ pool, token: a.token, profileId: a.profile.id }))
      .personal,
    { kind: 'available', savingsKg: '5', journeyCount: 2, excludedJourneys: 0 },
  );
  const balance = await pool.query(
    'SELECT balance FROM app.profiles WHERE id=$1',
    [a.profile.id],
  );
  assert.equal(
    balance.rows[0].balance,
    balanceBeforeRead.rows[0].balance,
    'impact reads cannot award additional points',
  );
  const legacy = await journey(a, 99, false, false, true);
  const retainedBefore = await pool.query(
    'SELECT receipt FROM app.journey_award_assessments WHERE journey_id=$1',
    [legacy.args.journeyId],
  );
  const server = createApi({
    pool,
    env: { NODE_ENV: 'test', AUTH_DEV_ENABLED: 'true', API_HOST: '127.0.0.1' },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/v1/profiles/${a.profile.id}/impact`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${a.token}` },
    });
    assert.equal(response.status, 200);
    const result = contributionsSchema.parse(await response.json());
    assert.equal(result.unit, 'kgCO2');
    assert.deepEqual(result.personal, {
      kind: 'available',
      savingsKg: '5',
      journeyCount: 2,
      excludedJourneys: 1,
    });
    assert.deepEqual(result.community, {
      kind: 'available',
      savingsKg: '9',
      journeyCount: 3,
      excludedJourneys: 1,
    });
    assert.ok(
      result.sources.every((source) => source.sourceUnit.startsWith('kgCO2/')),
    );
    const retainedAfter = await pool.query(
      'SELECT receipt FROM app.journey_award_assessments WHERE journey_id=$1',
      [legacy.args.journeyId],
    );
    assert.deepEqual(
      retainedAfter.rows,
      retainedBefore.rows,
      'legacy receipts remain immutable',
    );
    const blocker = await pool.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        'LOCK TABLE app.journey_award_assessments IN ACCESS EXCLUSIVE MODE',
      );
      const timedOut = await fetch(url, {
        headers: { Authorization: `Bearer ${a.token}` },
      });
      assert.equal(
        timedOut.status,
        503,
        'actual PostgreSQL statement timeout is a recoverable error',
      );
      assert.equal(timedOut.headers.get('cache-control'), 'no-store');
      assert.ok(
        !JSON.stringify(await timedOut.json()).includes('savingsKg'),
        'no truncated totals',
      );
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
    const recovered = await fetch(url, {
      headers: { Authorization: `Bearer ${a.token}` },
    });
    assert.equal(recovered.status, 200);
    assert.deepEqual(
      contributionsSchema.parse(await recovered.json()).personal,
      result.personal,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('real DB: lifetime cursor reads beyond one batch and a qualifying zero stays zero', async () => {
  const a = await fan();
  const source = await journey(a, 0, false, true);
  // Synthetic finished rows with no assessment make the cursor cross its batch
  // boundary. No award/history/precise-location rows are fabricated.
  await pool.query(
    `INSERT INTO app.journeys(id,profile_id,summary,snapshot,precise_expires_at)
    SELECT ids.id,j.profile_id,
      jsonb_set(jsonb_set(j.summary,'{id}',to_jsonb(ids.id)), '{source}',
        '{"kind":"live","provider":"synthetic-pagination-fixture"}'::jsonb),
      NULL,j.precise_expires_at
    FROM app.journeys j CROSS JOIN (SELECT gen_random_uuid() AS id FROM generate_series(1,101)) ids
    WHERE j.id=$1`,
    [source.args.journeyId],
  );
  await journey(a, 0);
  const result = await readContributions({
    pool,
    token: a.token,
    profileId: a.profile.id,
    policy: 'allow_unvalidated_estimates',
  });
  assert.deepEqual(result.personal, {
    kind: 'available',
    savingsKg: '0',
    journeyCount: 1,
    excludedJourneys: 101,
  });
});
