import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  contributionInput,
  sessionInput,
  resolutionInput,
  rankingPoints,
  rankingQuery,
} from './participation-contracts.ts';

test('a contribution confirms whole available points, at least ten, without client authority', () => {
  const input = { requestId: randomUUID(), points: 10 };
  assert.deepEqual(contributionInput.parse(input), input);
  for (const points of [0, 9, -10, 10.5, Infinity, NaN, '10', 2_147_483_648])
    assert.equal(
      contributionInput.safeParse({ ...input, points }).success,
      false,
    );
  for (const field of [
    'actorId',
    'profileId',
    'role',
    'approvedAt',
    'balance',
    'rankingPoints',
    'generation',
  ])
    assert.equal(
      contributionInput.safeParse({ ...input, [field]: 'forged' }).success,
      false,
    );
  assert.equal(
    contributionInput.parse({ ...input, points: 2_147_483_647 }).points,
    2_147_483_647,
  );
});

test('admin actions accept stable keys and explicit resolution, with no invented schedule or real fulfilment', () => {
  const requestId = randomUUID();
  assert.deepEqual(sessionInput.parse({ requestId }), { requestId });
  for (const field of ['sessionId', 'scheduledAt', 'count', 'role'])
    assert.equal(
      sessionInput.safeParse({ requestId, [field]: 'forged' }).success,
      false,
    );
  assert.equal(
    resolutionInput.parse({
      requestId,
      action: 'fulfil',
      reason: ' Demonstration answer ',
    }).reason,
    'Demonstration answer',
  );
  for (const action of ['approve', 'reopen', 'performed'])
    assert.equal(
      resolutionInput.safeParse({ requestId, action, reason: 'demo' }).success,
      false,
    );
  assert.equal(
    resolutionInput.safeParse({
      requestId,
      action: 'fulfil',
      reason: '',
      fulfilment: 'real',
    }).success,
    false,
  );
});

test('shared totals preserve arbitrary integer precision and ranking cursors preserve microseconds', () => {
  const large = '900719925474099300000000000001';
  assert.equal(rankingPoints.parse(large), large);
  for (const value of [10, '-1', '1.5', '01', '1e6'])
    assert.equal(rankingPoints.safeParse(value).success, false);
  assert.equal(rankingQuery.parse({}).limit, 25);
  assert.equal(rankingQuery.safeParse({ limit: 101 }).success, false);
  assert.equal(rankingQuery.safeParse({ tag: 'question' }).success, false);
});
