import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fork } from 'node:child_process';
import { test } from 'node:test';
import { createDatabase } from '../../database/index.ts';
import { migrate } from '../../database/migrate.ts';
import { createGoogleRouteBudget } from '../google-budget.ts';
import { createRouteProvider } from '../provider.ts';
import { createApi } from '../../api/app.ts';
import { ensureAccount } from '../../accounts/store.ts';
import { createSession } from '../../auth/session.ts';

const database = new URL(process.env.DATABASE_URL ?? 'http://invalid');
if (
  process.env.NODE_ENV !== 'test' ||
  database.hostname !== '127.0.0.1' ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(database.pathname)
)
  throw new Error('Use this worktree isolated test database.');

const env = { AMR_GOOGLE_ROUTES_KEY: 'synthetic-never-dispatched-key' };
const input = {
  origin: 'Singapore',
  destination: 'Botanic Gardens',
  modes: ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'],
  extraMinutes: 10,
};
const workerPath = new URL('./google-budget-worker.ts', import.meta.url);

test('durable Google lifetime cap across concurrency, restart and failure', async (t) => {
  const pool = createDatabase();
  const budget = createGoogleRouteBudget(pool);
  const localFetch = globalThis.fetch;
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ routes: [] }),
  );
  const used = async () =>
    (
      await pool.query<{ used_attempts: number }>(
        'SELECT used_attempts FROM app.google_route_budget',
      )
    ).rows[0].used_attempts;
  const reset = async (n = 0) => {
    await pool.query('UPDATE app.google_route_budget SET used_attempts=$1', [
      n,
    ]);
  };
  try {
    await migrate(pool);
    await t.test(
      'registered live configuration spends from the durable row after authentication',
      async () => {
        await reset(196);
        const identity = await ensureAccount(pool, {
          issuer: 'urn:google-budget-test',
          subject: 'fan',
        });
        const session = await createSession(pool, identity.id);
        const api = createApi({
          pool,
          env: {
            ...env,
            NODE_ENV: 'test',
            AUTH_ISSUER: 'https://unprovisioned.example.test',
            AUTH_AUDIENCE: 'amr-api',
            AUTH_JWKS_URL: 'https://unprovisioned.example.test/keys',
            AUTH_REQUIRED_SCOPE: 'account.access',
          },
        });
        // Call the captured original fetch only for this local API; Google stays mocked.
        try {
          api.listen(0, '127.0.0.1');
          await once(api, 'listening');
          const address = api.address();
          assert.ok(address && typeof address === 'object');
          const request = (token?: string) =>
            localFetch(`http://127.0.0.1:${address.port}/v1/routes/query`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify(input),
            });
          const denied = await request();
          assert.equal(denied.status, 401);
          await denied.body?.cancel();
          assert.equal(await used(), 196);
          const before = fetch.mock.callCount();
          await (await request(session.token)).json();
          assert.equal(await used(), 200);
          assert.equal(fetch.mock.callCount() - before, 4);
          const exhausted = await (await request(session.token)).json();
          assert.equal(exhausted.result.reason, 'budget_exhausted');
          assert.equal(fetch.mock.callCount() - before, 4);
        } finally {
          api.closeAllConnections();
          await new Promise<void>((resolve) => api.close(() => resolve()));
        }
      },
    );
    await t.test(
      'four separate processes admit exactly 200 of 320 attempts',
      async () => {
        await reset();
        const workers = Array.from({ length: 4 }, () =>
          fork(workerPath, ['race'], { silent: true }),
        );
        try {
          const totals = await Promise.all(
            workers.map(async (worker) => {
              const exit = once(worker, 'exit');
              const [total] = await once(worker, 'message');
              const [code] = await exit;
              assert.equal(code, 0);
              assert.equal(typeof total, 'number');
              return Number(total);
            }),
          );
          assert.equal(
            totals.reduce((a, b) => a + b, 0),
            200,
          );
          assert.equal(await used(), 200);
          const restartedPool = createDatabase();
          try {
            assert.equal(
              await createGoogleRouteBudget(restartedPool).reserve(1),
              false,
            );
          } finally {
            await restartedPool.end();
          }
        } finally {
          for (const worker of workers)
            if (worker.exitCode === null) worker.kill('SIGKILL');
        }
      },
    );
    await t.test(
      'process cancellation before reservation spends zero; after commit burns four',
      async () => {
        await reset();
        for (const phase of ['before', 'after']) {
          const worker = fork(workerPath, [phase], { silent: true });
          try {
            const [message] = await once(worker, 'message');
            assert.equal(message, phase);
            const exit = once(worker, 'exit');
            worker.kill('SIGKILL');
            await exit;
            assert.equal(await used(), phase === 'before' ? 0 : 4);
          } finally {
            if (worker.exitCode === null) worker.kill('SIGKILL');
          }
        }
      },
    );
    await t.test(
      'comparison is all-or-nothing; final attempt succeeds and never resets',
      async () => {
        await reset(199);
        assert.equal(await budget.reserve(4), false);
        assert.equal(await used(), 199);
        assert.equal(await budget.reserve(1), true);
        assert.equal(await budget.reserve(1), false);
        for (const n of [0, -1, 1.5, 5, NaN])
          await assert.rejects(budget.reserve(n));
        assert.equal(await used(), 200);
      },
    );
    await t.test(
      'lost reservation acknowledgement burns committed attempts with zero dispatch',
      async () => {
        await reset();
        const before = fetch.mock.callCount();
        const provider = createRouteProvider(env, {
          async reserve(n) {
            await budget.reserve(n);
            throw new Error('Injected lost commit acknowledgement');
          },
        });
        assert.deepEqual(await provider.search(input), {
          kind: 'unavailable',
          reason: 'provider_error',
        });
        assert.equal(await used(), 4);
        assert.equal(fetch.mock.callCount(), before);
      },
    );
    await t.test(
      'database lock outlives deadline; late commit burns but cannot dispatch',
      async () => {
        await reset();
        const lock = await pool.connect();
        const before = fetch.mock.callCount();
        const completed = Promise.withResolvers<void>();
        try {
          await lock.query('BEGIN');
          await lock.query('SELECT * FROM app.google_route_budget FOR UPDATE');
          const provider = createRouteProvider(
            { ...env, AMR_ROUTES_TIMEOUT_MS: '25' },
            {
              async reserve(n) {
                try {
                  return await budget.reserve(n);
                } finally {
                  completed.resolve();
                }
              },
            },
          );
          assert.deepEqual(await provider.search(input), {
            kind: 'unavailable',
            reason: 'timeout',
          });
          assert.equal(fetch.mock.callCount(), before);
          await lock.query('ROLLBACK');
          await completed.promise;
          assert.equal(await used(), 4);
          assert.equal(fetch.mock.callCount(), before);
        } finally {
          await lock.query('ROLLBACK');
          lock.release();
        }
      },
    );
    await t.test(
      'missing row and SQL error fail closed without recreating allowance',
      async () => {
        await pool.query('DELETE FROM app.google_route_budget');
        const before = fetch.mock.callCount();
        assert.deepEqual(await createRouteProvider(env, budget).search(input), {
          kind: 'unavailable',
          reason: 'budget_exhausted',
        });
        await pool.query(
          'ALTER TABLE app.google_route_budget RENAME TO google_route_budget_test_hold',
        );
        try {
          assert.deepEqual(
            await createRouteProvider(env, budget).search(input),
            { kind: 'unavailable', reason: 'provider_error' },
          );
        } finally {
          await pool.query(
            'ALTER TABLE app.google_route_budget_test_hold RENAME TO google_route_budget',
          );
          await pool.query(
            'INSERT INTO app.google_route_budget(singleton) VALUES(true)',
          );
        }
        assert.equal(fetch.mock.callCount(), before);
      },
    );
  } finally {
    await pool.end();
  }
});
