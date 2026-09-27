import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Pool } from 'pg';
import { quoteAiCost, reserveAiCost } from './cost-reservation.ts';
import { createPostgresAiCostStore } from './postgres-cost-store.ts';

const rateCard = {
  revision: 'fixture_only',
  expiresAtMs: 2000,
  models: [
    {
      model: 'typesafe/jev-1.13',
      inputNanoUsdPerToken: 0,
      outputNanoUsdPerToken: 0,
      fixedNanoUsd: 1,
    },
  ],
};
const plan = {
  operationId: 'fixture',
  fingerprint: 'a'.repeat(64),
  calls: [
    {
      id: 'decide',
      model: 'typesafe/jev-1.13',
      maxInputTokens: 1,
      maxOutputTokens: 1,
    },
  ],
};

test('store rejects every non-active identity before database access', async (t) => {
  const pool = new Pool();
  const connect = t.mock.method(pool, 'connect', async () => {
    throw new Error('No network allowed');
  });
  const store = createPostgresAiCostStore(pool);
  const quote = quoteAiCost(rateCard, plan, 1000);
  assert.equal(quote.kind, 'quoted');
  if (quote.kind !== 'quoted') return;
  try {
    for (const scope of [
      'amr-tokenrouter-dev-and-demo',
      'worktree-budget',
      '',
    ]) {
      const identity = {
        scope,
        operationId: plan.operationId,
        fingerprint: plan.fingerprint,
        callId: 'decide',
      };
      for (const [action, input] of [
        [store.reserve, { ...quote.reservation, scope }],
        [store.claimCall, identity],
        [store.cancelCall, identity],
        [
          store.reconcile,
          { ...identity, accounting: { kind: 'reported', chargedNanoUsd: 0 } },
        ],
      ] as const)
        await assert.rejects(Reflect.apply(action, store, [input]), {
          message: 'AI cost store unavailable or conflicting operation.',
        });
    }
    assert.equal(connect.mock.callCount(), 0);
  } finally {
    await pool.end();
  }
});

test('database failure is a denied reservation without connection details', async (t) => {
  const pool = new Pool();
  t.mock.method(pool, 'connect', async () => {
    throw new Error('fixture private connection details');
  });
  try {
    assert.deepEqual(
      await reserveAiCost({
        store: createPostgresAiCostStore(pool),
        rateCard,
        plan,
        nowMs: 1000,
      }),
      {
        kind: 'unavailable',
        reason: 'budget-unavailable',
      },
    );
  } finally {
    await pool.end();
  }
});
