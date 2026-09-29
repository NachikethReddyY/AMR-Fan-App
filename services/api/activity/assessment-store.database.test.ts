import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, afterEach, before, test } from 'node:test';
import { testDatabaseName } from '../../../scripts/local-db.mjs';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount } from '../accounts/store.ts';
import { ApiError, type Account, type Profile } from '../accounts/types.ts';
import {
  beginAssessment,
  completeAssessment,
  readAssessment,
  readAssessmentByRequest,
} from './assessment-store.ts';
if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${testDatabaseName()}`
)
  throw new Error('Owned test database required');
const pool = createDatabase();
const issuer = `urn:amr:evidence-test:${randomUUID()}`;
const owned: string[] = [];
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
let account: Account, real: Profile, demo: Profile;
before(async () => {
  await migrate(pool);
  account = await ensureAccount(pool, { issuer, subject: randomUUID() });
  const r = account.profiles.find((p) => p.kind === 'real');
  const d = account.profiles.find((p) => p.kind === 'demo');
  assert.ok(r && d);
  real = r;
  demo = d;
  owned.push(r.id, d.id);
});
afterEach(async () => {
  await pool.query(
    'DELETE FROM app.activity_assessments WHERE profile_id = ANY($1::uuid[])',
    [owned],
  );
});
after(async () => {
  try {
    await pool.query(
      'DELETE FROM app.activity_assessments WHERE profile_id = ANY($1::uuid[])',
      [owned],
    );
  } finally {
    await pool.end();
  }
});
function input(profileId = real.id, key = randomUUID(), d = digest(key)) {
  return {
    pool,
    principalId: account.id,
    profileId,
    requestId: key,
    payloadDigest: d,
    missionId: null,
    imageHashes: [digest(key + 'image')],
  };
}
const unavailable = { kind: 'unavailable', reason: 'provider' } as const;

test('begin, complete, replay exact result', async () => {
  const i = input();
  const started = await beginAssessment(i);
  assert.equal(started.kind, 'started');
  if (started.kind !== 'started') return;
  const done = await completeAssessment({
    pool,
    id: started.id,
    payloadDigest: i.payloadDigest,
    result: unavailable,
  });
  assert.deepEqual(await beginAssessment(i), { kind: 'replay', result: done });
});
test('same request id conflicting digest is 409', async () => {
  const i = input();
  const s = await beginAssessment(i);
  assert.equal(s.kind, 'started');
  await assert.rejects(
    beginAssessment({ ...i, payloadDigest: digest('other') }),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
});
test('concurrent identical begin yields one started and one busy', async () => {
  const i = input();
  const r = await Promise.all([beginAssessment(i), beginAssessment(i)]);
  assert.equal(r.filter((x) => x.kind === 'started').length, 1);
  assert.equal(r.filter((x) => x.kind === 'busy').length, 1);
});
test('expired processing replays an explicit expired result', async () => {
  const i = input();
  const s = await beginAssessment(i);
  assert.equal(s.kind, 'started');
  if (s.kind !== 'started') return;
  await pool.query(
    "UPDATE app.activity_assessments SET started_at=clock_timestamp()-interval '31 seconds' WHERE id=$1",
    [s.id],
  );
  assert.deepEqual(await beginAssessment(i), {
    kind: 'replay',
    result: { kind: 'expired', reason: 'assessment_expired' },
  });
});
test('GET by request recovers stale processing as explicit expired result', async () => {
  const i = input();
  const s = await beginAssessment(i);
  assert.equal(s.kind, 'started');
  if (s.kind !== 'started') return;
  await pool.query(
    "UPDATE app.activity_assessments SET started_at=clock_timestamp()-interval '31 seconds' WHERE id=$1",
    [s.id],
  );
  assert.deepEqual(
    await readAssessmentByRequest({
      pool,
      principalId: account.id,
      profileId: real.id,
      requestId: i.requestId,
    }),
    {
      kind: 'replay',
      result: { kind: 'expired', reason: 'assessment_expired' },
    },
  );
});
test('demo profile is rejected and cross-principal read is denied', async () => {
  await assert.rejects(
    beginAssessment(input(demo.id)),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
  const other = await ensureAccount(pool, { issuer, subject: randomUUID() });
  const i = input();
  const s = await beginAssessment(i);
  assert.equal(s.kind, 'started');
  if (s.kind === 'started')
    await assert.rejects(
      readAssessment({
        pool,
        principalId: other.id,
        profileId: real.id,
        id: s.id,
      }),
      (e: unknown) => e instanceof ApiError && e.status === 404,
    );
});
test('wrong completion digest leaves processing', async () => {
  const i = input();
  const s = await beginAssessment(i);
  assert.equal(s.kind, 'started');
  if (s.kind !== 'started') return;
  await assert.rejects(
    completeAssessment({
      pool,
      id: s.id,
      payloadDigest: digest('wrong'),
      result: unavailable,
    }),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
  assert.deepEqual(
    await readAssessment({
      pool,
      principalId: account.id,
      profileId: real.id,
      id: s.id,
    }),
    { kind: 'busy' },
  );
});
