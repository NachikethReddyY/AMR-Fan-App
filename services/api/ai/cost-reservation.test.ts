import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aiCostReservationSchema,
  quoteAiCost,
  reserveAiCost,
  accountAiUsage,
  type AiCostStore,
} from './cost-reservation.ts';

// Deliberately artificial rates; never used for a provider request.
const rateCard = {
  revision: 'fixture_rates',
  expiresAtMs: 2000,
  models: [
    {
      model: 'openai/gpt-6-luna',
      inputNanoUsdPerToken: 100,
      outputNanoUsdPerToken: 500,
      fixedNanoUsd: 1000,
    },
    {
      model: 'typesafe/jev-1.13',
      inputNanoUsdPerToken: 50,
      outputNanoUsdPerToken: 0,
      fixedNanoUsd: 0,
    },
  ],
};
const plan = {
  operationId: 'activity_1',
  fingerprint: 'a'.repeat(64),
  calls: [
    {
      id: 'observe',
      model: 'openai/gpt-6-luna',
      maxInputTokens: 1000,
      maxOutputTokens: 100,
    },
    {
      id: 'decide',
      model: 'typesafe/jev-1.13',
      maxInputTokens: 1000,
      maxOutputTokens: 100,
    },
  ],
};
const quote = () => quoteAiCost(rateCard, plan, 1000);

test('quote reserves both stages with integer nano-USD and the same $10 scope', () => {
  const result = quote();
  assert.equal(result.kind, 'quoted');
  if (result.kind !== 'quoted') return;
  assert.equal(result.reservation.scope, 'amr-new-calls-20260927-v1');
  assert.equal(result.reservation.capNanoUsd, 10_000_000_000);
  assert.equal(result.reservation.reservedNanoUsd, 201000);
  assert.deepEqual(
    result.reservation.calls.map((x) => x.reservedNanoUsd),
    [151000, 50000],
  );
});

for (const [name, card, request] of [
  ['no rates', undefined, plan],
  ['expired', { ...rateCard, expiresAtMs: 999 }, plan],
  [
    'duplicate model',
    { ...rateCard, models: [rateCard.models[0], rateCard.models[0]] },
    plan,
  ],
  [
    'negative rate',
    {
      ...rateCard,
      models: [{ ...rateCard.models[0], inputNanoUsdPerToken: -1 }],
    },
    plan,
  ],
  [
    'fractional rate',
    {
      ...rateCard,
      models: [{ ...rateCard.models[0], inputNanoUsdPerToken: 0.1 }],
    },
    plan,
  ],
  [
    'invented model',
    rateCard,
    { ...plan, calls: [{ ...plan.calls[0], model: 'other' }] },
  ],
  [
    'unbounded tokens',
    rateCard,
    { ...plan, calls: [{ ...plan.calls[0], maxInputTokens: Infinity }] },
  ],
  [
    'duplicate call',
    rateCard,
    { ...plan, calls: [plan.calls[0], plan.calls[0]] },
  ],
  [
    'excess calls',
    rateCard,
    { ...plan, calls: [...plan.calls, plan.calls[0]] },
  ],
  ['untrusted cost', rateCard, { ...plan, cost: 0 }],
] as const)
  test(`invalid or unverified admission: ${name}`, () =>
    assert.equal(quoteAiCost(card, request, 1000).kind, 'unavailable'));

test('overflow-scale products cannot wrap, round down or exceed the shared cap', () => {
  const result = quoteAiCost(
    {
      ...rateCard,
      models: rateCard.models.map((x) => ({
        ...x,
        inputNanoUsdPerToken: 1_000_000_000,
      })),
    },
    plan,
    1000,
  );
  assert.deepEqual(result, { kind: 'unavailable', reason: 'cap-exceeded' });
});

test('known usage bills exact integer amounts; missing or invalid usage holds all funds', () => {
  const result = quote();
  assert.equal(result.kind, 'quoted');
  if (result.kind !== 'quoted') return;
  const call = result.reservation.calls[0];
  assert.deepEqual(accountAiUsage(call, { inputTokens: 10, outputTokens: 3 }), {
    kind: 'reported',
    chargedNanoUsd: 3500,
  });
  for (const usage of [
    undefined,
    null,
    {},
    { inputTokens: -1, outputTokens: 3 },
    { inputTokens: 1.1, outputTokens: 3 },
    { inputTokens: 0, outputTokens: 0, refunded: true },
  ])
    assert.deepEqual(accountAiUsage(call, usage), {
      kind: 'held',
      heldNanoUsd: 151000,
      reason: 'usage-unknown',
    });
  assert.deepEqual(
    accountAiUsage(call, { inputTokens: 1001, outputTokens: 3 }),
    { kind: 'held', heldNanoUsd: 151000, reason: 'bound-exceeded' },
  );
});

test('no store or store failure denies admission without a provider call', async () => {
  assert.deepEqual(await reserveAiCost({ rateCard, plan, nowMs: 1000 }), {
    kind: 'unavailable',
    reason: 'budget-unavailable',
  });
  const store: AiCostStore = {
    async reserve() {
      throw new Error('secret not returned');
    },
    async claimCall() {
      return false;
    },
    async reconcile() {},
  };
  assert.deepEqual(
    await reserveAiCost({ store, rateCard, plan, nowMs: 1000 }),
    { kind: 'unavailable', reason: 'budget-unavailable' },
  );
});

test('synthetic atomic store receives common scope and rejects duplicate/restarted callers', async () => {
  let reserveCalls = 0;
  const reservations = new Set<string>();
  const store: AiCostStore = {
    async reserve(reservation) {
      reserveCalls++;
      assert.equal(reservation.scope, 'amr-new-calls-20260927-v1');
      const key = reservation.operationId;
      if (reservations.has(key)) return 'duplicate';
      reservations.add(key);
      return 'reserved';
    },
    async claimCall() {
      return false;
    },
    async reconcile() {},
  };
  const results = await Promise.all(
    Array.from({ length: 2 }, () =>
      reserveAiCost({ store, rateCard, plan, nowMs: 1000 }),
    ),
  );
  assert.deepEqual(
    results.map((x) => x.kind),
    ['reserved', 'unavailable'],
  );
  assert.deepEqual(results[1], { kind: 'unavailable', reason: 'duplicate' });
  assert.equal(reserveCalls, 2);
});

test('invalid plan never enters the durable store; exhausted funds remain exhausted', async () => {
  let calls = 0;
  const store: AiCostStore = {
    async reserve() {
      calls++;
      return 'exhausted';
    },
    async claimCall() {
      return false;
    },
    async reconcile() {},
  };
  await reserveAiCost({
    store,
    rateCard,
    plan: { ...plan, operationId: '' },
    nowMs: 1000,
  });
  assert.equal(calls, 0);
  assert.deepEqual(
    await reserveAiCost({ store, rateCard, plan, nowMs: 1000 }),
    { kind: 'unavailable', reason: 'exhausted' },
  );
  assert.equal(calls, 1);
});

test('shared synthetic store denies aggregate overspend across distinct operation ids', async () => {
  let committedOrHeld = 9_999_700_000;
  const store: AiCostStore = {
    async reserve(reservation) {
      if (
        committedOrHeld + reservation.reservedNanoUsd >
        reservation.capNanoUsd
      )
        return 'exhausted';
      committedOrHeld += reservation.reservedNanoUsd;
      return 'reserved';
    },
    async claimCall() {
      return false;
    },
    async reconcile() {},
  };
  const results = await Promise.all(
    ['one', 'two'].map((operationId) =>
      reserveAiCost({
        store,
        rateCard,
        plan: { ...plan, operationId },
        nowMs: 1000,
      }),
    ),
  );
  assert.deepEqual(
    results.map((x) => x.kind),
    ['reserved', 'unavailable'],
  );
  assert.equal(committedOrHeld, 9_999_901_000);
});

for (const scope of ['amr-tokenrouter-dev-and-demo', 'worktree-budget', '']) {
  test(`reservation schema rejects non-active scope: ${scope}`, () => {
    const result = quote();
    assert.equal(result.kind, 'quoted');
    if (result.kind !== 'quoted') return;
    assert.equal(
      aiCostReservationSchema.safeParse({ ...result.reservation, scope })
        .success,
      false,
    );
  });
}
