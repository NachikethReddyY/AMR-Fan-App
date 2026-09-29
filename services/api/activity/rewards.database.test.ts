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
let profile: { id: string };
let principalId: string;
let token: string;
const accepted = (assessmentId: string) => ({
  kind: 'accepted' as const,
  assessmentId,
  category: 'cleanup' as const,
  evidenceScore: 80,
  confidence: 0.9,
  rationale: 'Visible cleanup evidence.',
  evidenceItems: ['Collected waste'],
  modelVersion: 'fixture',
  policyVersion: 'activity-evidence-v1' as const,
});
async function addAssessment(hash: string, profileId = profile.id) {
  const assessmentId = randomUUID();
  const requestId = randomUUID();
  const payloadDigest = createHash('sha256').update(requestId).digest('hex');
  const result = accepted(assessmentId);
  await pool.query(
    `INSERT INTO app.activity_assessments
      (id,profile_id,request_id,payload_digest,mission_id,status,image_hashes,result)
     VALUES ($1,$2,$3,$4,NULL,'processing',$5,$6)`,
    [
      assessmentId,
      profileId,
      requestId,
      payloadDigest,
      JSON.stringify([hash]),
      result,
    ],
  );
  return { assessmentId, requestId, payloadDigest, result };
}
before(async () => {
  await migrate(pool);
  const account = await ensureAccount(pool, {
    issuer: `urn:amr:gate2-reward:${randomUUID()}`,
    subject: randomUUID(),
  });
  principalId = account.id;
  profile = account.profiles.find((item) => item.kind === 'real')!;
  token = (await createSession(pool, account.id)).token;
});
after(() => pool.end());

test('accepted evidence awards fixed 50 points and exact same-key replay', async () => {
  const hash =
    randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  const fixture = await addAssessment(hash);
  const first = await settleAcceptedActivity({
    pool,
    token,
    principalId,
    profileId: profile.id,
    assessmentId: fixture.assessmentId,
    requestId: fixture.requestId,
    payloadDigest: fixture.payloadDigest,
    missionId: null,
    imageHashes: [hash],
    assessment: fixture.result,
    sourceContext: 'synthetic_test',
  });
  assert.equal(first.outcome.reward.kind, 'awarded');
  assert.equal(first.outcome.reward.points, 50);
  const replay = await settleAcceptedActivity({
    pool,
    token,
    principalId,
    profileId: profile.id,
    assessmentId: fixture.assessmentId,
    requestId: fixture.requestId,
    payloadDigest: fixture.payloadDigest,
    missionId: null,
    imageHashes: [hash],
    assessment: fixture.result,
    sourceContext: 'synthetic_test',
  });
  assert.deepEqual(replay.outcome, first.outcome);
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM app.points_operations WHERE request_id=$1',
        [fixture.requestId],
      )
    ).rows[0].n,
    1,
  );
});

test('cross-profile duplicate evidence is denied without a zero ledger row', async () => {
  const other = await ensureAccount(pool, {
    issuer: `urn:amr:gate2-reward:${randomUUID()}`,
    subject: randomUUID(),
  });
  const otherProfile = other.profiles.find((item) => item.kind === 'real')!;
  const otherToken = (await createSession(pool, other.id)).token;
  const hash =
    randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  const firstFixture = await addAssessment(hash);
  const first = await settleAcceptedActivity({
    pool,
    token,
    principalId,
    profileId: profile.id,
    assessmentId: firstFixture.assessmentId,
    requestId: firstFixture.requestId,
    payloadDigest: firstFixture.payloadDigest,
    missionId: null,
    imageHashes: [hash],
    assessment: firstFixture.result,
    sourceContext: 'synthetic_test',
  });
  assert.equal(first.outcome.reward.kind, 'awarded');
  const secondFixture = await addAssessment(hash, otherProfile.id);
  const result = await settleAcceptedActivity({
    pool,
    token: otherToken,
    principalId: other.id,
    profileId: otherProfile.id,
    assessmentId: secondFixture.assessmentId,
    requestId: secondFixture.requestId,
    payloadDigest: secondFixture.payloadDigest,
    missionId: null,
    imageHashes: [hash],
    assessment: secondFixture.result,
    sourceContext: 'synthetic_test',
  });
  assert.equal(result.outcome.reward.kind, 'not_awarded');
  assert.equal(result.outcome.reward.reason, 'duplicate_evidence');
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM app.points_operations WHERE request_id=$1',
        [secondFixture.requestId],
      )
    ).rows[0].n,
    0,
  );
});
