import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { assignRole, ensureAccount } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';
import { adjustPoints, readPointsHistory } from '../points/index.ts';
import { createSubmission, listOwnSubmissions } from './index.ts';
import { ApiError } from '../accounts/types.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use this worktree disposable test database.');

const pool = createDatabase();
const issuer = `urn:amr:submissions-test:${randomUUID()}`;
async function account(subject: string, admin = false) {
  const value = await ensureAccount(pool, { issuer, subject });
  if (admin)
    await assignRole(pool, value.id, 'admin', 'Synthetic submission test');
  const session = await createSession(pool, value.id);
  const real = value.profiles.find((profile) => profile.kind === 'real');
  const demo = value.profiles.find((profile) => profile.kind === 'demo');
  assert.ok(real && demo);
  return { ...value, token: session.token, real, demo };
}
before(() => migrate(pool));
after(() => pool.end());

test('a fan with 600 points submits once, retains 100 and sees a persistent pending submission linked to History', async () => {
  const admin = await account('admin', true);
  const fan = await account('fan');
  await adjustPoints(pool, admin.token, {
    targetProfileId: fan.real.id,
    requestId: randomUUID(),
    delta: 600,
    reason: 'Synthetic submission allowance',
  });
  const input = {
    requestId: randomUUID(),
    text: 'What inspires your race preparation?',
    tag: 'question',
    confirmedFee: 500,
  };
  const result = await createSubmission(pool, fan.token, fan.real.id, input);
  assert.equal(result.entry.delta, -500);
  assert.equal(result.entry.balanceAfter, 100);
  assert.equal(result.outcome.status, 'pending');
  assert.equal(result.outcome.rankingPoints, 0);
  assert.equal(result.outcome.pointsOperationId, result.entry.id);
  assert.equal(result.outcome.ownerProfileId, fan.real.id);
  const page = await listOwnSubmissions(pool, fan.token, fan.real.id);
  assert.deepEqual(page.submissions, [result.outcome]);
  const history = await readPointsHistory(pool, fan.token, fan.real.id);
  assert.equal(history.balance, 100);
  assert.equal(history.entries.length, 2);
  assert.deepEqual(history.entries[0], result.entry);
  assert.deepEqual(
    await createSubmission(pool, fan.token, fan.real.id, input),
    result,
  );
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).entries.length,
    2,
  );
});

const status = (expected: number) => (error: unknown) =>
  error instanceof ApiError && error.status === expected;
async function grant(token: string, profileId: string, delta: number) {
  return adjustPoints(pool, token, {
    targetProfileId: profileId,
    requestId: randomUUID(),
    delta,
    reason: 'Synthetic submission allowance',
  });
}
const intent = (text = 'A fan suggestion') => ({
  requestId: randomUUID(),
  text,
  confirmedFee: 500,
});

test('concurrent retries charge once and concurrent new submissions cannot overspend', async () => {
  const admin = await account('concurrency-admin', true);
  const fan = await account('concurrency-fan');
  await grant(admin.token, fan.real.id, 600);
  const input = intent();
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      createSubmission(pool, fan.token, fan.real.id, input),
    ),
  );
  for (const result of results) assert.deepEqual(result, results[0]);
  assert.equal(
    (await listOwnSubmissions(pool, fan.token, fan.real.id)).submissions.length,
    1,
  );
  await assert.rejects(
    createSubmission(pool, fan.token, fan.real.id, {
      ...input,
      text: 'Different action',
    }),
    status(409),
  );
  await assert.rejects(
    createSubmission(pool, fan.token, fan.demo.id, input),
    status(409),
  );
  await grant(admin.token, fan.real.id, 500);
  const competing = await Promise.allSettled([
    createSubmission(pool, fan.token, fan.real.id, intent('Question')),
    createSubmission(pool, fan.token, fan.real.id, intent('Activity')),
  ]);
  assert.equal(
    competing.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    competing.filter(
      (result) => result.status === 'rejected' && status(409)(result.reason),
    ).length,
    1,
  );
  const history = await readPointsHistory(pool, fan.token, fan.real.id);
  assert.equal(history.balance, 100);
  assert.equal(
    history.entries.filter((entry) => entry.kind === 'fan_submission').length,
    2,
  );
  assert.equal(
    (await listOwnSubmissions(pool, fan.token, fan.real.id)).submissions.length,
    2,
  );
});

test('unaffordable submissions roll back both content and debit; foreign owners and anonymous callers cannot read or spend', async () => {
  const fan = await account('unaffordable-fan');
  const stranger = await account('stranger');
  await assert.rejects(
    createSubmission(pool, fan.token, fan.real.id, intent()),
    status(409),
  );
  assert.deepEqual(
    (await listOwnSubmissions(pool, fan.token, fan.real.id)).submissions,
    [],
  );
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).entries.length,
    0,
  );
  await assert.rejects(
    createSubmission(pool, stranger.token, fan.real.id, intent()),
    status(404),
  );
  await assert.rejects(
    listOwnSubmissions(pool, stranger.token, fan.real.id),
    status(404),
  );
  await assert.rejects(
    createSubmission(pool, '', fan.real.id, intent()),
    status(401),
  );
  await assert.rejects(listOwnSubmissions(pool, '', fan.real.id), status(401));
});
