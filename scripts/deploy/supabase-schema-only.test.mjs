import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import pg from 'pg';
import { createGoogleRouteBudget } from '../../services/api/routes/google-budget.ts';
import { createRouteProvider } from '../../services/api/routes/provider.ts';
import { bootstrapDatabase, OWNER, RUNTIME } from './supabase-database.mjs';
import { createPostgresAiCostStore } from '../../services/api/ai/postgres-cost-store.ts';
import {
  quoteAiCost,
  reserveAiCost,
} from '../../services/api/ai/cost-reservation.ts';

if (process.env.AMR_OPS123_DISPOSABLE !== 'true')
  throw new Error('Owned disposable fixture only.');
const password = (await readFile('/run/amr-test/password', 'utf8')).trim();
const connection = {
  host: '127.0.0.1',
  database: 'postgres',
  password,
  max: 3,
};
for (const targetCount of [11, 12]) {
  const admin = new pg.Pool({ ...connection, user: 'postgres' });
  const runtime = new pg.Pool({ ...connection, user: RUNTIME });
  const deployer = new pg.Pool({ ...connection, user: 'schema_deployer' });
  const schemaOnly = {
    aiBudgetMode: 'schema-install-only',
    targetMigration:
      targetCount === 11
        ? '0011_ai_cost_store.sql'
        : '0012_google_route_budget.sql',
  };
  const initialized = {
    aiBudgetInitialization: 'verified-no-prior-spend-or-inflight',
  };
  const aiTables = ['ai_cost_budget', 'ai_cost_operations', 'ai_cost_calls'];

  async function snapshot() {
    return (
      await admin.query(`SELECT jsonb_build_object(
    'ledger',(SELECT jsonb_agg(t ORDER BY name) FROM public.schema_migrations t),
    'roles',(SELECT jsonb_agg(t ORDER BY rolname) FROM
      (SELECT oid,rolname,rolpassword FROM pg_authid WHERE rolname IN ('amr_api','amr_migration_owner')) t),
    'tables',(SELECT jsonb_agg(t ORDER BY relname) FROM
      (SELECT c.oid,c.relname,c.relowner,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app') t),
    'columns',(SELECT jsonb_agg(t ORDER BY attrelid,attnum) FROM
      (SELECT a.attrelid,a.attnum,a.attacl::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND a.attnum>0 AND NOT a.attisdropped) t),
    'principals',(SELECT jsonb_agg(t ORDER BY id) FROM app.principals t)
  ) AS state`)
    ).rows[0].state;
  }
  async function accounting() {
    return Promise.all(
      aiTables.map(
        async (table) =>
          (await admin.query(`SELECT * FROM app.${table} ORDER BY 1,2`)).rows,
      ),
    );
  }

  // This wrapper injects failure at the real DB boundary, retaining the transaction.
  function failAfterSuspension() {
    return {
      async connect() {
        const client = await deployer.connect();
        return {
          async query(sql, values) {
            const result = await client.query(sql, values);
            if (
              sql.startsWith('UPDATE app.ai_cost_budget SET suspended=true')
            ) {
              assert.equal(result.rowCount, 1);
              assert.equal(
                (await client.query('SELECT suspended FROM app.ai_cost_budget'))
                  .rows[0].suspended,
                true,
              );
              assert.equal(
                (
                  await admin.query(
                    "SELECT to_regclass('app.ai_cost_budget') IS NULL absent",
                  )
                ).rows[0].absent,
                true,
              );
              throw new Error('Injected failure after new AI suspension');
            }
            return result;
          },
          release() {
            client.release();
          },
        };
      },
    };
  }

  test(`schema-only target ${targetCount}, denied AI admission and immutable replay`, async (t) => {
    try {
      await admin.query(`CREATE ROLE schema_deployer LOGIN CREATEROLE PASSWORD ${pg.escapeLiteral(password)};
      GRANT CREATE ON DATABASE postgres TO schema_deployer WITH GRANT OPTION;
      GRANT USAGE,CREATE ON SCHEMA public TO schema_deployer WITH GRANT OPTION;
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE schema_observer NOLOGIN`);
      await bootstrapDatabase(deployer, password, {
        targetMigration: '0010_photo_activity.sql',
      });
      await runtime.query(
        "INSERT INTO app.principals(issuer,subject) VALUES('urn:schema-test','retained')",
      );
      const retained = await snapshot();
      await assert.rejects(
        bootstrapDatabase(deployer, password),
        /AI budget initialization requires/,
      );
      assert.deepEqual(await snapshot(), retained);

      await t.test(
        'failure after suspension rolls back DDL, ledger and rights',
        async () => {
          await assert.rejects(
            bootstrapDatabase(failAfterSuspension(), password, schemaOnly),
            /Injected failure after new AI suspension/,
          );
          assert.deepEqual(await snapshot(), retained);
          assert.equal(
            (
              await admin.query(
                "SELECT to_regclass('app.ai_cost_budget') IS NULL absent",
              )
            ).rows[0].absent,
            true,
          );
        },
      );

      if (targetCount === 12)
        await t.test(
          'late Google DDL failure rolls back both migrations and suspension',
          async () => {
            await admin.query(`CREATE FUNCTION public.schema_fail() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN
        IF to_regclass('app.google_route_budget') IS NOT NULL THEN RAISE EXCEPTION 'late Google migration failure'; END IF;
        END $$; CREATE EVENT TRIGGER schema_fail ON ddl_command_end WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION public.schema_fail()`);
            try {
              await assert.rejects(
                bootstrapDatabase(deployer, password, schemaOnly),
                /late Google migration failure/,
              );
              assert.deepEqual(await snapshot(), retained);
              assert.equal(
                (
                  await admin.query(
                    "SELECT to_regclass('app.ai_cost_budget') IS NULL AND to_regclass('app.google_route_budget') IS NULL absent",
                  )
                ).rows[0].absent,
                true,
              );
            } finally {
              await admin.query(
                'DROP EVENT TRIGGER schema_fail; DROP FUNCTION public.schema_fail()',
              );
            }
          },
        );

      await t.test(
        'concurrent installers wait on the same lock and replay',
        async () => {
          const lock = await admin.connect();
          let pending;
          try {
            await lock.query('BEGIN');
            await lock.query('SELECT pg_advisory_xact_lock(48136291)');
            pending = Promise.allSettled([
              bootstrapDatabase(deployer, password, schemaOnly),
              bootstrapDatabase(deployer, password, schemaOnly),
            ]);
            const deadline = Date.now() + 5000;
            let waiting = 0;
            do {
              waiting = (
                await admin.query(
                  "SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND objid=48136291 AND NOT granted",
                )
              ).rows[0].n;
              if (waiting === 2) break;
              await new Promise((resolve) => setTimeout(resolve, 20));
            } while (Date.now() < deadline);
            assert.equal(waiting, 2);
            assert.deepEqual(await snapshot(), retained);
          } finally {
            await lock.query('ROLLBACK');
            lock.release();
          }
          const results = await pending;
          for (const result of results)
            assert.equal(result.status, 'fulfilled');
          assert.deepEqual(results.map((result) => result.value.state).sort(), [
            'unchanged',
            'upgraded',
          ]);
          for (const result of results) {
            assert.equal(result.value.migrations, targetCount);
            assert.equal(
              result.value.aiBudget,
              'schema-installed-accounting-unverified-spending-disabled',
            );
          }
        },
      );

      const installed = await snapshot();
      assert.deepEqual(installed.roles, retained.roles);
      assert.deepEqual(installed.principals, retained.principals);
      assert.deepEqual(installed.ledger.slice(0, 10), retained.ledger);
      assert.deepEqual(
        installed.tables.filter(
          (row) =>
            !row.relname.startsWith('ai_cost_') &&
            !row.relname.startsWith('google_route_budget'),
        ),
        retained.tables,
      );
      const retainedIds = new Set(retained.tables.map((row) => row.oid));
      assert.deepEqual(
        installed.columns.filter((row) => retainedIds.has(row.attrelid)),
        retained.columns,
      );
      assert.equal(
        installed.ledger[10].checksum,
        'be6baf0dd4ccb209c266a3646a9f8494bbb2c6ca74b79f3cbef3dc0956c8013b',
      );
      assert.equal(
        (await admin.query('SELECT suspended FROM app.ai_cost_budget')).rows[0]
          .suspended,
        true,
      );

      await t.test(
        'actual runtime cannot read, write, unsuspend, reserve or claim AI',
        async () => {
          for (const table of aiTables) {
            for (const sql of [
              `SELECT * FROM app.${table}`,
              `DELETE FROM app.${table}`,
              `TRUNCATE app.${table}`,
            ])
              await assert.rejects(
                runtime.query(sql),
                (error) => error.code === '42501',
              );
          }
          await assert.rejects(
            runtime.query('UPDATE app.ai_cost_budget SET suspended=false'),
            (error) => error.code === '42501',
          );
          const rateCard = {
            revision: 'fixture_only',
            expiresAtMs: Date.now() + 60000,
            models: [
              {
                model: 'openai/gpt-6-luna',
                inputNanoUsdPerToken: 1,
                outputNanoUsdPerToken: 1,
                fixedNanoUsd: 1,
              },
            ],
          };
          const plan = {
            operationId: 'denied',
            fingerprint: 'a'.repeat(64),
            calls: [
              {
                id: 'observe',
                model: 'openai/gpt-6-luna',
                maxInputTokens: 1,
                maxOutputTokens: 1,
              },
            ],
          };
          const store = createPostgresAiCostStore(runtime);
          const quote = quoteAiCost(rateCard, plan, Date.now());
          assert.equal(quote.kind, 'quoted');
          await assert.rejects(store.reserve(quote.reservation));
          await assert.rejects(
            store.claimCall({
              scope: 'amr-tokenrouter-dev-and-demo',
              operationId: 'denied',
              callId: 'observe',
              fingerprint: plan.fingerprint,
            }),
          );
          let dispatches = 0;
          const admission = await reserveAiCost({ store, rateCard, plan });
          if (admission.kind === 'reserved') dispatches++;
          assert.deepEqual(admission, {
            kind: 'unavailable',
            reason: 'budget-unavailable',
          });
          assert.equal(dispatches, 0);
        },
      );

      await t.test(
        'nonzero liability, receipts and calls survive all replay paths',
        async () => {
          await admin.query(`UPDATE app.ai_cost_budget SET committed_nano_usd=11000000000;
        INSERT INTO app.ai_cost_operations(operation_id,scope,fingerprint,reservation,rate_expires_at_ms)
          VALUES('unknown-history','amr-tokenrouter-dev-and-demo',repeat('b',64),'{}',1);
        INSERT INTO app.ai_cost_calls(operation_id,call_id,reserved_nano_usd,state,accounted_nano_usd)
          VALUES('unknown-history','held',10,'held',10),('unknown-history','receipt',10,'disputed',3)`);
          const before = await accounting();
          for (const options of [
            { targetMigration: schemaOnly.targetMigration },
            { ...initialized, targetMigration: schemaOnly.targetMigration },
          ]) {
            await assert.rejects(
              bootstrapDatabase(deployer, password, options),
              /privilege collision/,
            );
            assert.deepEqual(await accounting(), before);
            assert.deepEqual(await snapshot(), installed);
          }
          assert.equal(
            (await bootstrapDatabase(deployer, 'z'.repeat(48), schemaOnly))
              .state,
            'unchanged',
          );
          assert.deepEqual(await accounting(), before);
          assert.deepEqual(await snapshot(), installed);
        },
      );

      for (const [grant, revoke] of [
        [
          'GRANT SELECT ON app.ai_cost_budget TO amr_api',
          'REVOKE SELECT ON app.ai_cost_budget FROM amr_api',
        ],
        [
          'GRANT UPDATE(suspended) ON app.ai_cost_budget TO amr_api WITH GRANT OPTION',
          'REVOKE UPDATE(suspended) ON app.ai_cost_budget FROM amr_api',
        ],
        [
          'GRANT SELECT(state) ON app.ai_cost_calls TO PUBLIC',
          'REVOKE SELECT(state) ON app.ai_cost_calls FROM PUBLIC',
        ],
        [
          'GRANT MAINTAIN ON app.ai_cost_operations TO amr_api',
          'REVOKE MAINTAIN ON app.ai_cost_operations FROM amr_api',
        ],
        [
          'GRANT SELECT ON app.ai_cost_calls TO schema_observer',
          'REVOKE SELECT ON app.ai_cost_calls FROM schema_observer',
        ],
        [
          'UPDATE app.ai_cost_budget SET suspended=false',
          'UPDATE app.ai_cost_budget SET suspended=true',
        ],
      ])
        await t.test(
          `schema-only refuses without repair: ${grant}`,
          async () => {
            await admin.query(grant);
            try {
              const before = await snapshot(),
                costs = await accounting();
              await assert.rejects(
                bootstrapDatabase(deployer, password, schemaOnly),
                /Disabled AI/,
              );
              assert.deepEqual(await snapshot(), before);
              assert.deepEqual(await accounting(), costs);
            } finally {
              await admin.query(revoke);
            }
          },
        );
      await t.test(
        'Google upgrade and runtime dispatch respect durable 200-attempt cap and replay',
        async () => {
          const googleOptions = {
            ...schemaOnly,
            targetMigration: '0012_google_route_budget.sql',
          };
          const costs = await accounting();
          const result = await bootstrapDatabase(
            deployer,
            password,
            googleOptions,
          );
          assert.equal(
            result.state,
            targetCount === 11 ? 'upgraded' : 'unchanged',
          );
          assert.equal(result.migrations, 12);
          const ledger = (
            await admin.query(
              'SELECT * FROM public.schema_migrations ORDER BY name',
            )
          ).rows;
          assert.equal(
            ledger[11].checksum,
            '00aeddb091fe0c43ff753ef6d89e937d041a07cef4849c06240f54aa625dff45',
          );
          const budget = createGoogleRouteBudget(runtime);
          const used = async () =>
            (
              await runtime.query(
                'SELECT used_attempts FROM app.google_route_budget',
              )
            ).rows[0].used_attempts;
          let dispatches = 0;
          const stub = t.mock.method(globalThis, 'fetch', async () => {
            // A different connection sees the entire reservation before dispatch.
            assert.equal(
              (
                await admin.query(
                  'SELECT used_attempts FROM app.google_route_budget',
                )
              ).rows[0].used_attempts,
              4,
            );
            dispatches++;
            return Response.json({ routes: [] });
          });
          try {
            const provider = createRouteProvider(
              {
                AMR_ROUTES_PROVIDER: 'google',
                AMR_GOOGLE_ROUTES_KEY: 'synthetic-never-dispatched',
              },
              budget,
            );
            const input = {
              origin: 'Singapore',
              destination: 'Botanic Gardens',
              modes: ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'],
              extraMinutes: 10,
            };
            await provider.search(input);
            assert.equal(dispatches, 4);
            const races = await Promise.all(
              Array.from({ length: 60 }, () => budget.reserve(4)),
            );
            assert.equal(races.filter(Boolean).length, 49);
            assert.equal(await used(), 200);
            assert.equal(await budget.reserve(1), false);
            const denied = await provider.search(input);
            assert.equal(denied.reason, 'budget_exhausted');
            assert.equal(
              dispatches,
              4,
              'No dispatch beyond the lifetime allowance',
            );
          } finally {
            stub.mock.restore();
          }
          for (const sql of [
            'INSERT INTO app.google_route_budget DEFAULT VALUES',
            'DELETE FROM app.google_route_budget',
            'TRUNCATE app.google_route_budget',
            'UPDATE app.google_route_budget SET singleton=false',
            'ALTER TABLE app.google_route_budget ADD COLUMN forbidden int',
          ])
            await assert.rejects(
              runtime.query(sql),
              (error) => error.code === '42501',
            );
          assert.equal(
            (await bootstrapDatabase(deployer, password, googleOptions)).state,
            'unchanged',
          );
          assert.equal(await used(), 200);
          assert.deepEqual(await accounting(), costs);
          assert.deepEqual(
            (
              await admin.query(
                'SELECT * FROM public.schema_migrations ORDER BY name',
              )
            ).rows,
            ledger,
          );
          for (const [grant, revoke] of [
            [
              'GRANT UPDATE ON app.google_route_budget TO amr_api',
              'REVOKE UPDATE ON app.google_route_budget FROM amr_api',
            ],
            [
              'GRANT SELECT ON app.google_route_budget TO PUBLIC',
              'REVOKE SELECT ON app.google_route_budget FROM PUBLIC',
            ],
            [
              'GRANT MAINTAIN ON app.google_route_budget TO amr_api',
              'REVOKE MAINTAIN ON app.google_route_budget FROM amr_api',
            ],
            [
              'GRANT UPDATE(used_attempts) ON app.google_route_budget TO amr_api WITH GRANT OPTION',
              'REVOKE GRANT OPTION FOR UPDATE(used_attempts) ON app.google_route_budget FROM amr_api',
            ],
          ]) {
            await admin.query(grant);
            try {
              const before = await snapshot();
              await assert.rejects(
                bootstrapDatabase(deployer, password, googleOptions),
                /privilege collision/,
              );
              assert.deepEqual(await snapshot(), before);
              assert.equal(await used(), 200);
            } finally {
              await admin.query(revoke);
            }
          }
        },
      );
    } finally {
      await runtime.end();
      await deployer.end();
      await admin.query(
        'DROP SCHEMA IF EXISTS app CASCADE; DROP TABLE IF EXISTS public.schema_migrations',
      );
      for (const name of [
        'schema_deployer',
        RUNTIME,
        OWNER,
        'anon',
        'authenticated',
        'schema_observer',
      ])
        if (
          (await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [name]))
            .rowCount
        )
          await admin.query(`DROP OWNED BY ${name} CASCADE; DROP ROLE ${name}`);
      await admin.end();
    }
  });
}
