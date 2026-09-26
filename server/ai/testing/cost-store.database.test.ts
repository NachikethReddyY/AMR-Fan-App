import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { databaseConfig } from '../../database/config.ts';
import { after, before, beforeEach, test } from 'node:test';
import { createDatabase } from '../../database/index.ts';
import { migrate } from '../../database/migrate.ts';
import { quoteAiCost, type AiCostReservation } from '../cost-reservation.ts';
import { createPostgresAiCostStore } from '../postgres-cost-store.ts';

// The runner owns this disposable database. Never use the shared developer DB.
const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
if (
  process.env.NODE_ENV !== 'test' ||
  url.hostname !== '127.0.0.1' ||
  url.pathname !== '/amr_ai_cost_test' ||
  process.env.AMR_AI_COST_ISOLATED !== 'true'
)
  throw new Error('Use the disposable AI cost-store test container.');
const pool = createDatabase();
const store = createPostgresAiCostStore(pool);
const identity = (r: AiCostReservation, callId = 'observe') => ({
  scope: r.scope,
  operationId: r.operationId,
  fingerprint: r.fingerprint,
  callId,
});
function reservation(operationId = 'one', cost = 6_000_000_000, stages = 1) {
  const result = quoteAiCost(
    {
      revision: 'synthetic_only',
      expiresAtMs: Date.now() + 60_000,
      models: [
        {
          model: 'openai/gpt-6-luna',
          inputNanoUsdPerToken: 0,
          outputNanoUsdPerToken: 0,
          fixedNanoUsd: cost,
        },
      ],
    },
    {
      operationId,
      fingerprint: 'a'.repeat(64),
      calls: ['observe', 'decide'].slice(0, stages).map((id) => ({
        id,
        model: 'openai/gpt-6-luna',
        maxInputTokens: 1,
        maxOutputTokens: 1,
      })),
    },
  );
  assert.equal(result.kind, 'quoted');
  if (result.kind !== 'quoted') throw new Error('Invalid fixture');
  return result.reservation;
}
before(async () => {
  await migrate(pool);
});
beforeEach(async () => {
  await pool.query('TRUNCATE app.ai_cost_calls, app.ai_cost_operations');
  await pool.query(
    'UPDATE app.ai_cost_budget SET committed_nano_usd = 0, suspended = false',
  );
});
after(async () => {
  await pool.end();
});

test('independent processes share admission and cannot replay a dispatch after exit', async () => {
  const run = async (action: string, r: AiCostReservation) => {
    const { stdout } = await promisify(execFile)(process.execPath, [
      fileURLToPath(new URL('./cost-store-process.ts', import.meta.url)),
      action,
      JSON.stringify(r),
    ]);
    return JSON.parse(stdout);
  };
  const one = reservation('process_a');
  const two = reservation('process_b');
  const results = await Promise.all([run('reserve', one), run('reserve', two)]);
  assert.deepEqual([...results].sort(), ['exhausted', 'reserved']);
  const winner = results[0] === 'reserved' ? one : two;
  assert.equal(await run('claim', winner), true);
  assert.equal(await run('claim', winner), false);
  assert.equal(await run('reserve', winner), 'duplicate');
});

test('expiry is checked after lock waits and leaves started holds intact', async () => {
  const r = { ...reservation(), rateExpiresAtMs: Date.now() + 300 };
  await store.reserve(r);
  const blocker = await pool.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT scope FROM app.ai_cost_budget FOR UPDATE');
    const pending = store.claimCall(identity(r));
    await setTimeout(Math.max(1, r.rateExpiresAtMs - Date.now() + 30));
    await blocker.query('COMMIT');
    assert.equal(await pending, false);
    assert.equal(await store.reserve(reservation('blocked')), 'exhausted');
    assert.equal(await store.cancelCall(identity(r)), true);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
  const started = {
    ...reservation('started'),
    rateExpiresAtMs: Date.now() + 300,
  };
  await store.reserve(started);
  assert.equal(await store.claimCall(identity(started)), true);
  await setTimeout(Math.max(1, started.rateExpiresAtMs - Date.now() + 30));
  assert.equal(await store.cancelCall(identity(started)), false);
  assert.equal(await store.reserve(reservation('still_blocked')), 'exhausted');
});

test('late bound violation retains exposure above cap and cannot be cleared by receipts', async () => {
  const r = reservation('late');
  await store.reserve(r);
  await store.claimCall(identity(r));
  await store.reconcile({
    ...identity(r),
    accounting: { kind: 'reported', chargedNanoUsd: 0 },
  });
  await store.reserve(reservation('spent_released', 10_000_000_000));
  const violation = {
    ...identity(r),
    accounting: {
      kind: 'held',
      heldNanoUsd: 6_000_000_000,
      reason: 'bound-exceeded',
    },
  } as const;
  await store.reconcile(violation);
  await store.reconcile(violation);
  const result = await pool.query(
    'SELECT committed_nano_usd, suspended FROM app.ai_cost_budget',
  );
  assert.deepEqual(result.rows, [
    { committed_nano_usd: '16000000000', suspended: true },
  ]);
  assert.equal(await store.reserve(reservation('denied', 0)), 'exhausted');
});

test('failed second-stage insert rolls back the entire admission', async () => {
  await pool.query(`CREATE FUNCTION app.fail_ai_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.call_id = 'decide' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER ai_failure BEFORE INSERT ON app.ai_cost_calls FOR EACH ROW EXECUTE FUNCTION app.fail_ai_fixture()`);
  try {
    await assert.rejects(
      store.reserve(reservation('rollback', 2_000_000_000, 2)),
    );
    assert.equal(
      (await pool.query('SELECT count(*) FROM app.ai_cost_operations')).rows[0]
        .count,
      '0',
    );
    assert.equal(
      (await pool.query('SELECT committed_nano_usd FROM app.ai_cost_budget'))
        .rows[0].committed_nano_usd,
      '0',
    );
  } finally {
    await pool.query(
      'DROP TRIGGER ai_failure ON app.ai_cost_calls; DROP FUNCTION app.fail_ai_fixture()',
    );
  }
  assert.equal(
    await store.reserve(reservation('rollback', 2_000_000_000, 2)),
    'reserved',
  );
});

test('column-scoped runtime grants support the store without destructive privileges', async () => {
  await pool.query(`CREATE ROLE ai_cost_runtime;
    GRANT USAGE ON SCHEMA app TO ai_cost_runtime;
    GRANT SELECT ON app.ai_cost_budget, app.ai_cost_operations, app.ai_cost_calls TO ai_cost_runtime;
    GRANT INSERT (operation_id, scope, fingerprint, reservation, rate_expires_at_ms) ON app.ai_cost_operations TO ai_cost_runtime;
    GRANT INSERT (operation_id, call_id, reserved_nano_usd, accounted_nano_usd) ON app.ai_cost_calls TO ai_cost_runtime;
    GRANT UPDATE (committed_nano_usd, suspended) ON app.ai_cost_budget TO ai_cost_runtime;
    GRANT UPDATE (state, accounted_nano_usd, bound_exceeded) ON app.ai_cost_calls TO ai_cost_runtime`);
  const runtimePool = new Pool({
    ...databaseConfig(),
    options: '-c role=ai_cost_runtime',
  });
  try {
    const runtime = createPostgresAiCostStore(runtimePool);
    const r = reservation('runtime', 2_000_000_000, 2);
    assert.equal(await runtime.reserve(r), 'reserved');
    assert.equal(await runtime.claimCall(identity(r)), true);
    await runtime.reconcile({
      ...identity(r),
      accounting: { kind: 'reported', chargedNanoUsd: 1 },
    });
    assert.equal(await runtime.cancelCall(identity(r, 'decide')), true);
    for (const sql of [
      'DELETE FROM app.ai_cost_budget',
      'TRUNCATE app.ai_cost_calls',
      'UPDATE app.ai_cost_budget SET cap_nano_usd = 10000000000',
      "UPDATE app.ai_cost_operations SET fingerprint = repeat('b', 64)",
      'ALTER TABLE app.ai_cost_calls ADD COLUMN forbidden text',
    ])
      await assert.rejects(runtimePool.query(sql));
  } finally {
    await runtimePool.end();
  }
});

test('independent callers cannot reserve above the fixed shared $10 cap', async () => {
  const other = createDatabase();
  try {
    const results = await Promise.all([
      store.reserve(reservation('dev')),
      createPostgresAiCostStore(other).reserve(reservation('hosted')),
    ]);
    assert.deepEqual(results.sort(), ['exhausted', 'reserved']);
    assert.equal(
      await store.reserve(reservation('remaining', 4_000_000_000)),
      'reserved',
    );
    assert.equal(await store.reserve(reservation('overflow', 1)), 'exhausted');
  } finally {
    await other.end();
  }
});

test('restart preserves holds, immutable requests and exactly-once claims', async () => {
  const r = reservation();
  await store.reserve(r);
  const other = createDatabase();
  const restarted = createPostgresAiCostStore(other);
  try {
    assert.equal(await restarted.reserve(r), 'duplicate');
    await assert.rejects(
      restarted.reserve({ ...r, fingerprint: 'b'.repeat(64) }),
    );
    await assert.rejects(restarted.reserve({ ...r, rateRevision: 'changed' }));
    assert.deepEqual(
      (
        await Promise.all([
          store.claimCall(identity(r)),
          restarted.claimCall(identity(r)),
        ])
      ).sort(),
      [false, true],
    );
    assert.equal(await restarted.claimCall(identity(r)), false);
    assert.equal(await restarted.reserve(reservation('another')), 'exhausted');
  } finally {
    await other.end();
  }
});

test('partial two-stage completion and unknown recovery retain precise spend', async () => {
  const r = reservation('two', 4_000_000_000, 2);
  await store.reserve(r);
  assert.equal(await store.claimCall(identity(r)), true);
  const reported = {
    ...identity(r),
    accounting: { kind: 'reported', chargedNanoUsd: 1_000_000_000 },
  } as const;
  await store.reconcile(reported);
  await store.reconcile(reported);
  assert.equal(await store.claimCall(identity(r, 'decide')), true);
  const held = {
    ...identity(r, 'decide'),
    accounting: {
      kind: 'held',
      heldNanoUsd: 4_000_000_000,
      reason: 'usage-unknown',
    },
  } as const;
  await store.reconcile(held);
  assert.equal(await store.reserve(reservation('too_large')), 'exhausted');
  await store.reconcile({
    ...held,
    accounting: { kind: 'reported', chargedNanoUsd: 2_000_000_000 },
  });
  await store.reconcile(held); // A delayed unknown result cannot overwrite a receipt.
  assert.equal(
    await store.reserve(reservation('remaining', 7_000_000_000)),
    'reserved',
  );
});

for (const conflictingCharge of [0, 4_000_000_000]) {
  test(`contradictory receipt ${conflictingCharge} restores a sticky full hold and suspends admission`, async () => {
    const r = reservation('conflicting_receipt');
    await store.reserve(r);
    const pending = reservation('pending_stage', 1_000_000_000);
    await store.reserve(pending);
    await store.claimCall(identity(r));
    await store.reconcile({
      ...identity(r),
      accounting: { kind: 'reported', chargedNanoUsd: 1_000_000_000 },
    });
    const conflict = {
      ...identity(r),
      accounting: { kind: 'reported', chargedNanoUsd: conflictingCharge },
    } as const;
    await assert.rejects(store.reconcile(conflict));
    const other = createDatabase();
    try {
      const restarted = createPostgresAiCostStore(other);
      await assert.rejects(restarted.reconcile(conflict));
      await assert.rejects(
        restarted.reconcile({
          ...identity(r),
          accounting: { kind: 'reported', chargedNanoUsd: 1_000_000_000 },
        }),
      );
      await assert.rejects(
        restarted.reconcile({
          ...identity(r),
          accounting: {
            kind: 'held',
            heldNanoUsd: 6_000_000_000,
            reason: 'usage-unknown',
          },
        }),
      );
      await assert.rejects(
        restarted.reconcile({
          ...identity(r),
          accounting: {
            kind: 'held',
            heldNanoUsd: 6_000_000_000,
            reason: 'bound-exceeded',
          },
        }),
      );
      assert.deepEqual(
        (
          await other.query(
            'SELECT committed_nano_usd, suspended FROM app.ai_cost_budget',
          )
        ).rows,
        [{ committed_nano_usd: '7000000000', suspended: true }],
      );
      assert.deepEqual(
        (
          await other.query(
            'SELECT state, accounted_nano_usd FROM app.ai_cost_calls WHERE operation_id = $1',
            [r.operationId],
          )
        ).rows,
        [{ state: 'disputed', accounted_nano_usd: '1000000000' }],
      );
      assert.equal(
        await restarted.reserve(reservation('nine_more', 9_000_000_000)),
        'exhausted',
      );
      assert.equal(
        await restarted.reserve(reservation('zero_more', 0)),
        'exhausted',
      );
      assert.equal(await restarted.claimCall(identity(pending)), false);
      assert.equal(await restarted.cancelCall(identity(r)), false);
    } finally {
      await other.end();
    }
  });
}

test('conflicting receipt after released funds are reused retains full exposure above cap', async () => {
  const r = reservation('conflict_after_reuse');
  await store.reserve(r);
  await store.claimCall(identity(r));
  await store.reconcile({
    ...identity(r),
    accounting: { kind: 'reported', chargedNanoUsd: 1_000_000_000 },
  });
  assert.equal(
    await store.reserve(reservation('nine', 9_000_000_000)),
    'reserved',
  );
  await assert.rejects(
    store.reconcile({
      ...identity(r),
      accounting: { kind: 'reported', chargedNanoUsd: 4_000_000_000 },
    }),
  );
  assert.deepEqual(
    (
      await pool.query(
        'SELECT committed_nano_usd, suspended FROM app.ai_cost_budget',
      )
    ).rows,
    [{ committed_nano_usd: '15000000000', suspended: true }],
  );
});

test('bound violation suspends admission and existing claims across reconnects', async () => {
  const r = reservation('bound', 2_000_000_000, 2);
  await store.reserve(r);
  await store.claimCall(identity(r));
  await store.reconcile({
    ...identity(r),
    accounting: {
      kind: 'held',
      heldNanoUsd: 2_000_000_000,
      reason: 'bound-exceeded',
    },
  });
  const other = createDatabase();
  try {
    const restarted = createPostgresAiCostStore(other);
    assert.equal(await restarted.reserve(reservation('free', 0)), 'exhausted');
    assert.equal(await restarted.claimCall(identity(r, 'decide')), false);
    await restarted.reconcile({
      ...identity(r),
      accounting: { kind: 'reported', chargedNanoUsd: 1 },
    });
    assert.equal(
      await restarted.reserve(reservation('still_suspended', 0)),
      'exhausted',
    );
  } finally {
    await other.end();
  }
});

test('only never-started calls can cancel; expiry never releases in-flight money', async () => {
  const r = reservation('cancel', 4_000_000_000, 2);
  await store.reserve(r);
  await store.claimCall(identity(r));
  assert.equal(await store.cancelCall(identity(r)), false);
  assert.equal(await store.cancelCall(identity(r, 'decide')), true);
  assert.equal(await store.cancelCall(identity(r, 'decide')), true);
  assert.equal(await store.claimCall(identity(r, 'decide')), false);
  assert.equal(
    await store.reserve(reservation('six', 6_000_000_000)),
    'reserved',
  );
});

test('forged amounts, unknown calls and pre-claim settlement cannot release budget', async () => {
  const r = reservation();
  await assert.rejects(store.reserve({ ...r, reservedNanoUsd: 0 }));
  await store.reserve(r);
  assert.equal(
    await store.claimCall({ ...identity(r), fingerprint: 'b'.repeat(64) }),
    false,
  );
  await assert.rejects(
    store.reconcile({
      ...identity(r),
      accounting: { kind: 'reported', chargedNanoUsd: 0 },
    }),
  );
  await store.claimCall(identity(r));
  for (const chargedNanoUsd of [-1, 0.1, NaN, Infinity, 6_000_000_001]) {
    await assert.rejects(
      store.reconcile({
        ...identity(r),
        accounting: { kind: 'reported', chargedNanoUsd },
      }),
    );
  }
  await assert.rejects(
    store.reconcile({
      ...identity(r),
      accounting: { kind: 'held', heldNanoUsd: 0, reason: 'usage-unknown' },
    }),
  );
  assert.equal(await store.reserve(reservation('denied')), 'exhausted');
});
