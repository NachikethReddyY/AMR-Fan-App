import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { assignRole, ensureAccount } from '../accounts/store.ts';
import { createSession, revokeSession } from '../auth/session.ts';
import { adjustPoints, readPointsHistory } from '../points/index.ts';
import {
  createSubmission,
  listOwnSubmissions,
  listAdminSubmissions,
  moderateSubmission,
} from './index.ts';
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

test('only a current assigned admin can approve a pending submission and the owner sees status without rewriting the fee', async () => {
  const admin = await account('moderation-admin', true);
  const fan = await account('moderation-fan');
  await grant(admin.token, fan.real.id, 600);
  const original = await createSubmission(
    pool,
    fan.token,
    fan.real.id,
    intent(),
  );
  const id = original.outcome.id;
  const decision = { requestId: randomUUID(), status: 'approved' };
  await assert.rejects(
    moderateSubmission(pool, fan.token, id, decision),
    status(403),
  );
  await assert.rejects(listAdminSubmissions(pool, fan.token), status(403));
  assert.ok(
    (await listAdminSubmissions(pool, admin.token)).submissions.some(
      (row) => row.id === id,
    ),
  );
  const approved = await moderateSubmission(pool, admin.token, id, decision);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.moderatedBy, admin.id);
  assert.ok(
    approved.moderatedAt && Number.isFinite(Date.parse(approved.moderatedAt)),
  );
  assert.equal(approved.rankingPoints, 0);
  assert.deepEqual(
    (await listOwnSubmissions(pool, fan.token, fan.real.id)).submissions,
    [approved],
  );
  const history = await readPointsHistory(pool, fan.token, fan.real.id);
  assert.equal(history.balance, 100);
  assert.deepEqual(history.entries[0], original.entry);
  assert.deepEqual(
    await moderateSubmission(pool, admin.token, id, decision),
    approved,
  );
  await assert.rejects(
    moderateSubmission(pool, admin.token, id, {
      ...decision,
      status: 'rejected',
    }),
    status(409),
  );
  await assert.rejects(
    moderateSubmission(pool, admin.token, id, {
      requestId: randomUUID(),
      status: 'rejected',
    }),
    status(409),
  );
});

test('competing admin decisions serialize, and role or session revocation denies reads, decisions and replays', async () => {
  const first = await account('race-admin-a', true);
  const second = await account('race-admin-b', true);
  const fan = await account('race-fan');
  await grant(first.token, fan.real.id, 1000);
  const one = await createSubmission(
    pool,
    fan.token,
    fan.real.id,
    intent('First'),
  );
  const two = await createSubmission(
    pool,
    fan.token,
    fan.real.id,
    intent('Second'),
  );
  const approved = { requestId: randomUUID(), status: 'approved' };
  const rejected = { requestId: randomUUID(), status: 'rejected' };
  const results = await Promise.allSettled([
    moderateSubmission(pool, first.token, one.outcome.id, approved),
    moderateSubmission(pool, second.token, one.outcome.id, rejected),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    results.filter(
      (result) => result.status === 'rejected' && status(409)(result.reason),
    ).length,
    1,
  );
  const winner = results[0].status === 'fulfilled' ? first : second;
  const decision = results[0].status === 'fulfilled' ? approved : rejected;
  await assert.rejects(
    moderateSubmission(pool, winner.token, two.outcome.id, decision),
    status(409),
  );
  await assignRole(pool, winner.id, 'fan', 'Synthetic revocation');
  await assert.rejects(listAdminSubmissions(pool, winner.token), status(403));
  await assert.rejects(
    moderateSubmission(pool, winner.token, one.outcome.id, decision),
    status(403),
  );
  await assert.rejects(
    moderateSubmission(pool, winner.token, two.outcome.id, {
      requestId: randomUUID(),
      status: 'approved',
    }),
    status(403),
  );
  await assignRole(pool, winner.id, 'admin', 'Synthetic restore');
  await revokeSession(pool, winner.token);
  await assert.rejects(listAdminSubmissions(pool, winner.token), status(401));
  await assert.rejects(
    moderateSubmission(pool, winner.token, one.outcome.id, decision),
    status(401),
  );
  await revokeSession(pool, fan.token);
  await assert.rejects(
    listOwnSubmissions(pool, fan.token, fan.real.id),
    status(401),
  );
});

test('rejection retains its fee and immutable history; a confirmed resubmission is a new paid record', async () => {
  const admin = await account('reject-admin', true);
  const fan = await account('reject-fan');
  const stranger = await account('reject-stranger');
  await grant(admin.token, fan.real.id, 1100);
  const input = intent('Original proposal');
  const original = await createSubmission(pool, fan.token, fan.real.id, input);
  await assert.rejects(
    createSubmission(pool, fan.token, fan.real.id, {
      ...intent(),
      resubmissionOf: original.outcome.id,
    }),
    status(409),
  );
  const rejected = await moderateSubmission(
    pool,
    admin.token,
    original.outcome.id,
    { requestId: randomUUID(), status: 'rejected' },
  );
  assert.deepEqual(
    await createSubmission(pool, fan.token, fan.real.id, input),
    original,
  );
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).balance,
    600,
  );
  await assert.rejects(
    createSubmission(pool, stranger.token, stranger.real.id, {
      ...intent(),
      resubmissionOf: original.outcome.id,
    }),
    status(404),
  );
  await assert.rejects(
    createSubmission(pool, fan.token, fan.real.id, {
      ...intent(),
      confirmedFee: 0,
      resubmissionOf: original.outcome.id,
    }),
    status(400),
  );
  const retry = await createSubmission(pool, fan.token, fan.real.id, {
    ...intent('Revised proposal'),
    resubmissionOf: original.outcome.id,
  });
  assert.notEqual(retry.outcome.id, original.outcome.id);
  assert.equal(retry.entry.balanceAfter, 100);
  assert.equal(retry.entry.delta, -500);
  assert.equal(retry.outcome.status, 'pending');
  const own = await listOwnSubmissions(pool, fan.token, fan.real.id);
  assert.deepEqual(own.submissions, [retry.outcome, rejected]);
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).entries.filter(
      (entry) => entry.kind === 'fan_submission',
    ).length,
    2,
  );
});

test('real and persistent demo profiles keep separate balances, submissions and owner pagination', async () => {
  const admin = await account('demo-admin', true);
  const fan = await account('demo-fan');
  await grant(admin.token, fan.real.id, 600);
  await grant(admin.token, fan.demo.id, 1000);
  const real = await createSubmission(
    pool,
    fan.token,
    fan.real.id,
    intent('Real profile question'),
  );
  const demoFirst = await createSubmission(
    pool,
    fan.token,
    fan.demo.id,
    intent('Demo question'),
  );
  const demoSecond = await createSubmission(
    pool,
    fan.token,
    fan.demo.id,
    intent('Demo activity'),
  );
  const resumed = await account('demo-fan');
  assert.equal(resumed.demo.id, fan.demo.id);
  assert.equal(resumed.real.id, fan.real.id);
  assert.equal(
    (await readPointsHistory(pool, resumed.token, resumed.real.id)).balance,
    100,
  );
  assert.equal(
    (await readPointsHistory(pool, resumed.token, resumed.demo.id)).balance,
    0,
  );
  assert.deepEqual(
    (await listOwnSubmissions(pool, resumed.token, resumed.real.id))
      .submissions,
    [real.outcome],
  );
  const page = await listOwnSubmissions(pool, resumed.token, resumed.demo.id, {
    limit: 1,
  });
  assert.deepEqual(page.submissions, [demoSecond.outcome]);
  assert.equal(page.nextCursor, demoSecond.outcome.sequence);
  const next = await listOwnSubmissions(pool, resumed.token, resumed.demo.id, {
    limit: 1,
    before: page.nextCursor,
  });
  assert.deepEqual(next.submissions, [demoFirst.outcome]);
  assert.equal(next.nextCursor, null);
  for (const query of [
    { limit: 0 },
    { limit: 101 },
    { before: '-1' },
    { before: '9'.repeat(20) },
    { owner: fan.real.id },
  ])
    await assert.rejects(
      listOwnSubmissions(pool, resumed.token, resumed.demo.id, query),
      status(400),
    );
});
