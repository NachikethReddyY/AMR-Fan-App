import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { namespaceFor } from '../../../scripts/local-db.mjs';
import { ensureAccount } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { settleAcceptedActivity } from './rewards.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${namespaceFor(fileURLToPath(new URL('../../', import.meta.url)))}_test`
)
  throw new Error('Owned test database required');

const pool = createDatabase();
const accepted = (assessmentId: string) => ({
  kind: 'accepted' as const,
  assessmentId,
  category: 'cleanup' as const,
  evidenceScore: 80,
  confidence: 0.9,
  rationale: 'fixture',
  evidenceItems: ['Collected waste'],
  modelVersion: 'fixture',
  policyVersion: 'activity-evidence-v1' as const,
});
async function fixture(
  profileId: string,
  hash = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''),
  missionId: string | null = null,
) {
  const assessmentId = randomUUID();
  const requestId = randomUUID();
  const payloadDigest = createHash('sha256').update(requestId).digest('hex');
  const result = accepted(assessmentId);
  await pool.query(
    `INSERT INTO app.activity_assessments (id,profile_id,request_id,payload_digest,mission_id,status,image_hashes,result) VALUES ($1,$2,$3,$4,$5,'processing',$6,$7)`,
    [
      assessmentId,
      profileId,
      requestId,
      payloadDigest,
      missionId,
      JSON.stringify([hash]),
      result,
    ],
  );
  return { assessmentId, requestId, payloadDigest, result, hash };
}
async function account() {
  const a = await ensureAccount(pool, {
    issuer: `urn:amr:gate2-accounting:${randomUUID()}`,
    subject: randomUUID(),
  });
  const p = a.profiles.find((x) => x.kind === 'real')!;
  return {
    principalId: a.id,
    profileId: p.id,
    token: (await createSession(pool, a.id)).token,
  };
}
async function settle(
  a: Awaited<ReturnType<typeof account>>,
  f: Awaited<ReturnType<typeof fixture>>,
  requestId = f.requestId,
  payloadDigest = f.payloadDigest,
  missionId: string | null = null,
) {
  return settleAcceptedActivity({
    pool,
    token: a.token,
    principalId: a.principalId,
    profileId: a.profileId,
    assessmentId: f.assessmentId,
    requestId,
    payloadDigest,
    missionId,
    imageHashes: [f.hash],
    assessment: f.result,
    sourceContext: 'synthetic_test',
  });
}
before(() => migrate(pool));
after(() => pool.end());

test('same request key concurrent submissions credit exactly once', async () => {
  const a = await account();
  const f = await fixture(a.profileId);
  const results = await Promise.all([settle(a, f), settle(a, f)]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].outcome.reward.kind, 'awarded');
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM app.activity_reward_claims WHERE assessment_id=$1',
        [f.assessmentId],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM app.points_operations WHERE request_id=$1',
        [f.requestId],
      )
    ).rows[0].n,
    1,
  );
});

test('completed mission emits one event and gives no mission bonus', async () => {
  const a = await account();
  const missionId = '4d7b7ad7-0f6f-4b98-9876-5e3c4e90d002';
  await pool.query(
    'INSERT INTO app.mission_enrollments(profile_id,mission_id,version) VALUES ($1,$2,1)',
    [a.profileId, missionId],
  );
  await pool.query(
    'INSERT INTO app.mission_progress(profile_id,mission_id,count) VALUES ($1,$2,0)',
    [a.profileId, missionId],
  );
  const first = await fixture(
    a.profileId,
    randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''),
    missionId,
  );
  const one = await settle(
    a,
    first,
    first.requestId,
    first.payloadDigest,
    missionId,
  );
  assert.equal(one.outcome.reward.kind, 'awarded');
  assert.equal(one.outcome.mission.kind, 'updated');
  const second = await fixture(
    a.profileId,
    randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''),
    missionId,
  );
  const two = await settle(
    a,
    second,
    second.requestId,
    second.payloadDigest,
    missionId,
  );
  assert.deepEqual(two.outcome.reward, {
    kind: 'not_awarded',
    points: 0,
    reason: 'mission_ineligible',
  });
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM app.mission_events WHERE profile_id=$1 AND mission_id=$2',
        [a.profileId, missionId],
      )
    ).rows[0].n,
    1,
  );
});

test('same request key with a different payload is rejected', async () => {
  const a = await account();
  const f = await fixture(a.profileId);
  await settle(a, f);
  await assert.rejects(
    () => settle(a, f, f.requestId, 'a'.repeat(64)),
    /payload changed|different action/,
  );
});

test('four concurrent credits permit exactly three awards', async () => {
  const a = await account();
  const results = await Promise.all(
    (await Promise.all([0, 1, 2, 3].map(() => fixture(a.profileId)))).map((f) =>
      settle(a, f),
    ),
  );
  assert.equal(
    results.filter((r) => r.outcome.reward.kind === 'awarded').length,
    3,
  );
  const fourth = results.find((r) => r.outcome.reward.kind === 'not_awarded')!;
  assert.deepEqual(fourth.outcome.reward, {
    kind: 'not_awarded',
    points: 0,
    reason: 'daily_cap',
  });
});

test('cross-profile concurrent duplicate image has one durable award', async () => {
  const a = await account();
  const b = await account();
  const hash = createHash('sha256').update(randomUUID()).digest('hex');
  const [fa, fb] = await Promise.all([
    fixture(a.profileId, hash),
    fixture(b.profileId, hash),
  ]);
  const results = await Promise.all([settle(a, fa), settle(b, fb)]);
  assert.equal(
    results.filter((r) => r.outcome.reward.kind === 'awarded').length,
    1,
  );
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM app.activity_credited_images WHERE image_hash=$1',
        [hash],
      )
    ).rows[0].n,
    1,
  );
});

test('revoked session and demo profile cannot settle activity', async () => {
  const a = await account();
  await pool.query(
    'UPDATE app.sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1',
    [createHash('sha256').update(a.token).digest('hex')],
  );
  await assert.rejects(
    async () => settle(a, await fixture(a.profileId)),
    /Sign in again/,
  );
  const d = await ensureAccount(pool, {
    issuer: `urn:demo:${randomUUID()}`,
    subject: randomUUID(),
  });
  const demo = d.profiles.find((p) => p.kind === 'demo')!;
  const da = {
    principalId: d.id,
    profileId: demo.id,
    token: (await createSession(pool, d.id)).token,
  };
  await assert.rejects(
    async () => settle(da, await fixture(demo.id)),
    /real profile/,
  );
});

test('historical UTC-day claims do not consume current day allowance', async () => {
  const a = await account();
  for (let i = 0; i < 3; i++) {
    const f = await fixture(a.profileId);
    const operationId = randomUUID();
    await pool.query(
      `INSERT INTO app.points_operations(id,actor_id,profile_id,request_id,kind,fingerprint,delta,balance_before,balance_after,reason,outcome)
      VALUES ($1,$2,$3,$4,'activity_evidence',$5,50,$6,$7,'Historical fixture','{}')`,
      [
        operationId,
        a.principalId,
        a.profileId,
        f.requestId,
        f.payloadDigest,
        i * 50,
        (i + 1) * 50,
      ],
    );
    await pool.query(
      `INSERT INTO app.activity_reward_claims(assessment_id,operation_id,profile_id,request_id,payload_digest,image_hashes,source_context,credited_at)
      VALUES ($1,$2,$3,$4,$5,$6,'synthetic_test',date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - interval '1 microsecond')`,
      [
        f.assessmentId,
        operationId,
        a.profileId,
        f.requestId,
        f.payloadDigest,
        JSON.stringify([f.hash]),
      ],
    );
  }
  await pool.query('UPDATE app.profiles SET balance=150 WHERE id=$1', [
    a.profileId,
  ]);
  const results = [];
  for (let i = 0; i < 4; i++)
    results.push(await settle(a, await fixture(a.profileId)));
  assert.equal(
    results.filter((r) => r.outcome.reward.kind === 'awarded').length,
    3,
  );
  assert.deepEqual(results[3].outcome.reward, {
    kind: 'not_awarded',
    points: 0,
    reason: 'daily_cap',
  });
});

test('late ledger failure rolls back mission progress and permits exact retry', async () => {
  const a = await account();
  const missionId = '4d7b7ad7-0f6f-4b98-9876-5e3c4e90d002';
  await pool.query(
    'INSERT INTO app.mission_enrollments(profile_id,mission_id,version) VALUES ($1,$2,1)',
    [a.profileId, missionId],
  );
  await pool.query(
    'INSERT INTO app.mission_progress(profile_id,mission_id,count) VALUES ($1,$2,0)',
    [a.profileId, missionId],
  );
  const f = await fixture(a.profileId, undefined, missionId);
  const name = `gate2_fail_${randomUUID().replaceAll('-', '')}`;
  await pool.query(
    `CREATE FUNCTION app.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.profile_id='${a.profileId}'::uuid THEN RAISE EXCEPTION 'fixture late failure'; END IF; RETURN NEW; END $$`,
  );
  try {
    await pool.query(
      `CREATE TRIGGER ${name} BEFORE INSERT ON app.points_operations FOR EACH ROW EXECUTE FUNCTION app.${name}()`,
    );
    await assert.rejects(
      () => settle(a, f, f.requestId, f.payloadDigest, missionId),
      /fixture late failure/,
    );
    const state = await pool.query(
      `SELECT p.balance, m.count, (SELECT count(*)::int FROM app.mission_events WHERE profile_id=p.id) AS events, (SELECT count(*)::int FROM app.activity_reward_claims WHERE profile_id=p.id) AS claims, (SELECT count(*)::int FROM app.points_operations WHERE profile_id=p.id) AS receipts FROM app.profiles p JOIN app.mission_progress m ON m.profile_id=p.id WHERE p.id=$1`,
      [a.profileId],
    );
    assert.deepEqual(state.rows[0], {
      balance: 0,
      count: 0,
      events: 0,
      claims: 0,
      receipts: 0,
    });
  } finally {
    await pool.query(`DROP TRIGGER IF EXISTS ${name} ON app.points_operations`);
    await pool.query(`DROP FUNCTION app.${name}()`);
  }
  assert.equal(
    (await settle(a, f, f.requestId, f.payloadDigest, missionId)).outcome.reward
      .kind,
    'awarded',
  );
});
