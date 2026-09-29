import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import pg from 'pg';
import { bootstrapDatabase, OWNER, RUNTIME } from './supabase-database.mjs';

if (process.env.AMR_OPS123_DISPOSABLE !== 'true')
  throw new Error('Owned disposable container required.');
const initialization = {
  aiBudgetInitialization: 'verified-no-prior-spend-or-inflight',
};
const password = (await readFile('/run/amr-test/password', 'utf8')).trim();
for (const [retainedCount, targetCount] of [
  [8, 10],
  [9, 10],
  [8, 11],
  [9, 11],
  [10, 11],
]) {
  const options =
    targetCount === 10
      ? { targetMigration: '0010_photo_activity.sql' }
      : initialization;
  const migration =
    retainedCount === 8
      ? '0009_submission_participation.sql'
      : retainedCount === 9
        ? '0010_photo_activity.sql'
        : '0011_ai_cost_store.sql';
  const collisionTable =
    retainedCount === 8
      ? 'fan_submission_selections'
      : retainedCount === 9
        ? 'photo_activity_claims'
        : 'ai_cost_calls';
  const pool = new pg.Pool({
    host: '127.0.0.1',
    user: 'postgres',
    database: 'postgres',
    password,
    max: 2,
  });
  const runtime = new pg.Pool({
    host: '127.0.0.1',
    user: RUNTIME,
    database: 'postgres',
    password,
    max: 1,
  });
  const deployer = new pg.Pool({
    host: '127.0.0.1',
    user: 'upgrade_deployer',
    database: 'postgres',
    password,
    max: 2,
  });

  async function previousInstallation(retainedCount) {
    await pool.query(`CREATE ROLE ${OWNER} NOLOGIN; CREATE ROLE ${RUNTIME} LOGIN PASSWORD ${pg.escapeLiteral(password)};
  CREATE ROLE upgrade_deployer LOGIN CREATEROLE PASSWORD ${pg.escapeLiteral(password)};
  GRANT ${OWNER} TO upgrade_deployer; GRANT USAGE,CREATE ON SCHEMA public TO ${OWNER}; GRANT CREATE ON DATABASE postgres TO ${OWNER}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${OWNER}`);
      await client.query(
        'CREATE TABLE public.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())',
      );
      const dir = new URL(
        '../../services/api/database/migrations/',
        import.meta.url,
      );
      for (const name of (await readdir(dir))
        .filter((name) => /^000[1-8]_/.test(name))
        .sort()) {
        const sql = await readFile(new URL(name, dir), 'utf8');
        await client.query(sql);
        await client.query(
          'INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)',
          [name, createHash('sha256').update(sql).digest('hex')],
        );
      }
      await client.query(`REVOKE ALL ON SCHEMA app FROM PUBLIC;
    GRANT USAGE ON SCHEMA app TO ${RUNTIME}; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA app TO ${RUNTIME};
    GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA app TO ${RUNTIME};
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO ${RUNTIME};
    REVOKE INSERT,UPDATE,DELETE ON app.principals,app.role_assignments FROM ${RUNTIME};
    GRANT INSERT(issuer,subject),UPDATE(subject) ON app.principals TO ${RUNTIME};
    RESET ROLE; REVOKE CREATE ON SCHEMA public FROM ${OWNER}; REVOKE CREATE ON DATABASE postgres FROM ${OWNER}`);
      if (retainedCount >= 9) {
        await client.query(`SET LOCAL ROLE ${OWNER}`);
        const name = '0009_submission_participation.sql';
        const sql = await readFile(new URL(name, dir), 'utf8');
        await client.query(sql);
        await client.query(
          'INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)',
          [name, createHash('sha256').update(sql).digest('hex')],
        );
        // Independent fixture of the already-shipped PR44 grants.
        await client.query(`REVOKE EXECUTE ON FUNCTION app.protect_participation_history(),app.close_interaction_once(),app.resolve_selection_once() FROM PUBLIC;
      GRANT SELECT,INSERT ON app.fan_submission_contributions,app.fan_submission_admin_actions,app.fan_interaction_sessions,app.fan_submission_selections TO ${RUNTIME};
      GRANT UPDATE(closed_by,closed_at,closed_action_id) ON app.fan_interaction_sessions TO ${RUNTIME};
      GRANT UPDATE(status,resolved_by,resolved_at,reason,resolved_action_id) ON app.fan_submission_selections TO ${RUNTIME};
      GRANT USAGE,SELECT ON SEQUENCE app.fan_interaction_sessions_sequence_seq TO ${RUNTIME};
      GRANT EXECUTE ON FUNCTION app.protect_participation_history(),app.close_interaction_once(),app.resolve_selection_once() TO ${RUNTIME}; RESET ROLE`);
      }
      if (retainedCount >= 10) {
        await client.query(`SET LOCAL ROLE ${OWNER}`);
        const name = '0010_photo_activity.sql';
        const sql = await readFile(new URL(name, dir), 'utf8');
        await client.query(sql);
        await client.query(
          'INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)',
          [name, createHash('sha256').update(sql).digest('hex')],
        );
        await client.query(
          `GRANT SELECT,INSERT ON app.photo_activity_claims TO ${RUNTIME}; RESET ROLE`,
        );
      }
      await client.query('COMMIT');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  test(`retained ${retainedCount} to ${targetCount} installation upgrades atomically with restricted access`, async (t) => {
    try {
      // Independently reconstruct the retained ledger, roles, grants and data.
      await previousInstallation(retainedCount);
      await pool.query(
        'CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE TABLE public.peer_data(id int); INSERT INTO public.peer_data VALUES(17)',
      );
      await runtime.query(
        "INSERT INTO app.principals(issuer,subject) VALUES('urn:upgrade','retained')",
      );
      const history = (
        await pool.query('SELECT * FROM public.schema_migrations ORDER BY name')
      ).rows;
      const roles = (
        await pool.query(
          'SELECT oid,rolname,rolpassword FROM pg_authid WHERE rolname=ANY($1) ORDER BY rolname',
          [[OWNER, RUNTIME]],
        )
      ).rows;
      const acl = (
        await pool.query(
          "SELECT nspname,nspacl::text FROM pg_namespace WHERE nspname IN ('app','public') ORDER BY nspname",
        )
      ).rows;
      const originalAcl = (
        await pool.query(
          "SELECT c.oid,relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' ORDER BY c.oid",
        )
      ).rows;

      const priorColumns = (
        await pool.query(
          "SELECT a.attrelid,a.attnum,a.attacl::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND a.attnum>0 ORDER BY a.attrelid,a.attnum",
        )
      ).rows;
      const priorFunctions = (
        await pool.query(
          "SELECT p.oid,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' ORDER BY p.oid",
        )
      ).rows;
      if (retainedCount >= 9) {
        for (const [label, grant, revoke] of [
          [
            'table grant option',
            'GRANT SELECT ON app.fan_submission_contributions TO amr_api WITH GRANT OPTION',
            'REVOKE GRANT OPTION FOR SELECT ON app.fan_submission_contributions FROM amr_api',
          ],
          [
            'column REFERENCES',
            'GRANT REFERENCES(points_operation_id) ON app.fan_submission_contributions TO amr_api',
            'REVOKE REFERENCES(points_operation_id) ON app.fan_submission_contributions FROM amr_api',
          ],
          [
            'column grant option',
            'GRANT UPDATE(closed_at) ON app.fan_interaction_sessions TO amr_api WITH GRANT OPTION',
            'REVOKE GRANT OPTION FOR UPDATE(closed_at) ON app.fan_interaction_sessions FROM amr_api',
          ],
          [
            'sequence grant option',
            'GRANT USAGE ON SEQUENCE app.fan_interaction_sessions_sequence_seq TO amr_api WITH GRANT OPTION',
            'REVOKE GRANT OPTION FOR USAGE ON SEQUENCE app.fan_interaction_sessions_sequence_seq FROM amr_api',
          ],
          [
            'function grant option',
            'GRANT EXECUTE ON FUNCTION app.close_interaction_once() TO amr_api WITH GRANT OPTION',
            'REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION app.close_interaction_once() FROM amr_api',
          ],
        ])
          await t.test(
            `retained participation refuses ${label} before DDL`,
            async () => {
              await pool.query(grant);
              const snapshot = async () =>
                (
                  await pool.query(`SELECT c.oid,'relation' kind,c.relacl::text acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app'
            UNION ALL SELECT a.attrelid,'column-'||a.attnum,a.attacl::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND a.attnum>0
            UNION ALL SELECT p.oid,'function',p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' ORDER BY oid,kind`)
                ).rows;
              try {
                const before = await snapshot();
                // Keep failing-first runs from applying pending SQL after missed validation.
                const readBeforeUpgrade = {
                  async connect() {
                    const client = await deployer.connect();
                    return {
                      query(sql, values) {
                        if (sql.startsWith('SET LOCAL ROLE'))
                          throw new Error(
                            'Retained ACL drift reached pending DDL',
                          );
                        return client.query(sql, values);
                      },
                      release() {
                        client.release();
                      },
                    };
                  },
                };
                await assert.rejects(
                  bootstrapDatabase(
                    readBeforeUpgrade,
                    password,
                    initialization,
                  ),
                  /Participation privilege collision/,
                );
                assert.deepEqual(await snapshot(), before);
                assert.deepEqual(
                  (
                    await pool.query(
                      'SELECT * FROM public.schema_migrations ORDER BY name',
                    )
                  ).rows,
                  history,
                );
                assert.equal(
                  (
                    await pool.query(
                      "SELECT to_regclass('app.ai_cost_budget') IS NULL absent",
                    )
                  ).rows[0].absent,
                  true,
                );
              } finally {
                await pool.query(revoke);
              }
            },
          );
      }

      await pool.query(
        'UPDATE public.schema_migrations SET checksum=repeat($1,64) WHERE name=$2',
        ['0', history[0].name],
      );
      await assert.rejects(
        bootstrapDatabase(deployer, password, options),
        /checksum/i,
      );
      await pool.query(
        'UPDATE public.schema_migrations SET checksum=$1 WHERE name=$2',
        [history[0].checksum, history[0].name],
      );
      await pool.query(
        `CREATE TABLE app.${collisionTable}(collision int); INSERT INTO app.${collisionTable} VALUES(19)`,
      );
      await assert.rejects(
        bootstrapDatabase(deployer, password, options),
        /ownership collision/i,
      );
      await pool.query(`ALTER TABLE app.${collisionTable} OWNER TO ${OWNER}`);
      await assert.rejects(
        bootstrapDatabase(deployer, password, options),
        /already exists/i,
      );
      assert.equal(
        (await pool.query(`SELECT collision FROM app.${collisionTable}`))
          .rows[0].collision,
        19,
      );
      if (retainedCount === 8) {
        assert.equal(
          (
            await pool.query(
              `SELECT to_regclass('app.${retainedCount === 8 ? 'fan_submission_contributions' : retainedCount === 9 ? 'photo_activity_claims' : 'ai_cost_budget'}') IS NULL absent`,
            )
          ).rows[0].absent,
          true,
        );
      }
      assert.deepEqual(
        (
          await pool.query(
            'SELECT * FROM public.schema_migrations ORDER BY name',
          )
        ).rows,
        history,
      );
      await pool.query(`DROP TABLE app.${collisionTable}`);
      const failureSql =
        targetCount === 11
          ? "CREATE FUNCTION public.upgrade_fail() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN IF to_regclass('app.ai_cost_calls') IS NOT NULL THEN RAISE EXCEPTION 'late budget migration failure'; END IF; END $$; CREATE EVENT TRIGGER upgrade_fail ON ddl_command_end WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION public.upgrade_fail()"
          : "CREATE FUNCTION public.upgrade_fail() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='immutable_photo_activity_truncate') THEN RAISE EXCEPTION 'late photo migration failure'; END IF; END $$; CREATE EVENT TRIGGER upgrade_fail ON ddl_command_end WHEN TAG IN ('CREATE TRIGGER') EXECUTE FUNCTION public.upgrade_fail()";
      await pool.query(failureSql);
      await assert.rejects(
        bootstrapDatabase(deployer, password, options),
        /late (budget|photo) migration failure/,
      );
      await pool.query(
        'DROP EVENT TRIGGER upgrade_fail; DROP FUNCTION public.upgrade_fail()',
      );
      assert.equal(
        (
          await pool.query(
            `SELECT to_regclass('app.${retainedCount === 8 ? 'fan_submission_contributions' : retainedCount === 9 ? 'photo_activity_claims' : 'ai_cost_budget'}') IS NULL absent`,
          )
        ).rows[0].absent,
        true,
      );
      assert.deepEqual(
        (
          await pool.query(
            'SELECT * FROM public.schema_migrations ORDER BY name',
          )
        ).rows,
        history,
      );
      await assert.rejects(
        bootstrapDatabase(deployer, password),
        /AI budget initialization requires/,
      );
      assert.deepEqual(
        (
          await pool.query(
            'SELECT * FROM public.schema_migrations ORDER BY name',
          )
        ).rows,
        history,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT to_regclass('app.ai_cost_budget') IS NULL absent",
          )
        ).rows[0].absent,
        true,
      );

      // Both real deployers must wait for the same advisory transaction lock.
      const blocker = await pool.connect();
      let upgrades = Promise.resolve([]);
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT pg_advisory_xact_lock(48136291)');
        upgrades = Promise.allSettled([
          bootstrapDatabase(deployer, password, options),
          bootstrapDatabase(deployer, password, options),
        ]);
        const deadline = Date.now() + 5000;
        let waiting = 0;
        do {
          waiting = (
            await pool.query(
              "SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND objid=48136291 AND NOT granted",
            )
          ).rows[0].n;
          if (waiting === 2) break;
          await new Promise((resolve) => setTimeout(resolve, 20));
        } while (Date.now() < deadline);
        assert.equal(
          waiting,
          2,
          'Both migrations wait before inspecting retained state',
        );
        assert.deepEqual(
          (
            await pool.query(
              'SELECT * FROM public.schema_migrations ORDER BY name',
            )
          ).rows,
          history,
        );
      } finally {
        await blocker.query('ROLLBACK');
        blocker.release();
        await upgrades;
      }
      const results = (await upgrades).map((result) => {
        assert.equal(result.status, 'fulfilled');
        return result.value;
      });
      assert.deepEqual(results.map((result) => result.state).sort(), [
        'unchanged',
        'upgraded',
      ]);
      assert.ok(results.every((result) => result.migrations === targetCount));
      assert.deepEqual(
        (
          await pool.query(
            'SELECT * FROM public.schema_migrations WHERE name<=$1 ORDER BY name',
            [history.at(-1).name],
          )
        ).rows,
        history,
      );
      assert.ok(
        JSON.stringify(
          (
            await pool.query(
              'SELECT oid,rolname,rolpassword FROM pg_authid WHERE rolname=ANY($1) ORDER BY rolname',
              [[OWNER, RUNTIME]],
            )
          ).rows,
        ) === JSON.stringify(roles),
        'Role identity and password remain unchanged',
      );
      assert.deepEqual(
        (
          await pool.query(
            "SELECT nspname,nspacl::text FROM pg_namespace WHERE nspname IN ('app','public') ORDER BY nspname",
          )
        ).rows,
        acl,
      );
      assert.deepEqual(
        (
          await pool.query(
            'SELECT oid,relacl::text FROM pg_class WHERE oid=ANY($1) ORDER BY oid',
            [originalAcl.map((r) => r.oid)],
          )
        ).rows,
        originalAcl,
      );
      assert.equal(
        (
          await runtime.query(
            "SELECT count(*)::int n FROM app.principals WHERE subject='retained'",
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (await pool.query('SELECT id FROM public.peer_data')).rows[0].id,
        17,
      );
      assert.deepEqual(
        (
          await pool.query(
            'SELECT attrelid,attnum,attacl::text FROM pg_attribute WHERE attrelid=ANY($1) AND attnum>0 ORDER BY attrelid,attnum',
            [originalAcl.map((row) => row.oid)],
          )
        ).rows,
        priorColumns,
      );
      assert.deepEqual(
        (
          await pool.query(
            'SELECT oid,proacl::text FROM pg_proc WHERE oid=ANY($1) ORDER BY oid',
            [priorFunctions.map((row) => row.oid)],
          )
        ).rows,
        priorFunctions,
      );
      const upgradedHistory = (
        await pool.query('SELECT * FROM public.schema_migrations ORDER BY name')
      ).rows;
      assert.equal(upgradedHistory.length, targetCount);
      const expectedHistory = await Promise.all(
        (
          await readdir(
            new URL('../../services/api/database/migrations/', import.meta.url),
          )
        )
          .filter((name) => /^\d{4}_.*\.sql$/.test(name))
          .sort()
          .slice(0, targetCount)
          .map(async (name) => ({
            name,
            checksum: createHash('sha256')
              .update(
                await readFile(
                  new URL(
                    `../../services/api/database/migrations/${name}`,
                    import.meta.url,
                  ),
                ),
              )
              .digest('hex'),
          })),
      );
      assert.deepEqual(
        upgradedHistory.map(({ name, checksum }) => ({ name, checksum })),
        expectedHistory,
      );

      const checksum = createHash('sha256')
        .update(
          await readFile(
            new URL(
              `../../services/api/database/migrations/${migration}`,
              import.meta.url,
            ),
          ),
        )
        .digest('hex');
      assert.equal(
        (
          await pool.query(
            'SELECT checksum FROM public.schema_migrations WHERE name=$1',
            [migration],
          )
        ).rows[0].checksum,
        checksum,
      );

      const client = await runtime.connect();
      try {
        await client.query('BEGIN');
        const actor = (
          await client.query(
            "SELECT id FROM app.principals WHERE subject='retained'",
          )
        ).rows[0].id;
        const profile = (
          await client.query(
            "INSERT INTO app.profiles(principal_id,kind) VALUES($1,'real') RETURNING id",
            [actor],
          )
        ).rows[0].id;
        const operation = '44444444-4444-4444-8444-444444444444';
        await client.query(
          "INSERT INTO app.points_operations(id,actor_id,profile_id,request_id,kind,fingerprint,delta,balance_before,balance_after,reason,outcome) VALUES($1,$2,$3,$1,'photo-activity',repeat('b',64),50,0,50,'fixture photo','{}')",
          [operation, actor, profile],
        );
        await client.query(
          "INSERT INTO app.photo_activity_claims(id,profile_id,photo_hash,operation_id,activity,confidence,credited_points,credit_context) VALUES($1,$2,repeat('c',64),$1,'other',0.9,50,'synthetic_test')",
          [operation, profile],
        );
        assert.equal(
          (
            await client.query(
              'SELECT credited_points FROM app.photo_activity_claims WHERE id=$1',
              [operation],
            )
          ).rows[0].credited_points,
          50,
        );
        const action = '33333333-3333-4333-8333-333333333333';
        await client.query(
          "INSERT INTO app.fan_submission_admin_actions(id,actor_id,request_id,kind,fingerprint,outcome) VALUES($1,$2,$1,'create',repeat('a',64),'{}')",
          [action, actor],
        );
        const session = (
          await client.query(
            'INSERT INTO app.fan_interaction_sessions(created_by,created_action_id) VALUES($1,$2) RETURNING id,sequence',
            [actor, action],
          )
        ).rows[0];
        assert.ok(session.sequence);
        await client.query(
          'UPDATE app.fan_interaction_sessions SET closed_by=$1,closed_at=clock_timestamp(),closed_action_id=$2 WHERE id=$3',
          [actor, action, session.id],
        );
        for (const table of [
          'fan_submission_contributions',
          'fan_submission_admin_actions',
          'fan_interaction_sessions',
          'fan_submission_selections',
        ])
          await client.query(`SELECT * FROM app.${table} LIMIT 1`);
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
      assert.equal(
        (
          await runtime.query(
            'SELECT count(*)::int n FROM app.fan_interaction_sessions',
          )
        ).rows[0].n,
        0,
      );
      for (const sql of [
        'CREATE TABLE app.forbidden(id int)',
        'UPDATE public.schema_migrations SET checksum=checksum',
        'DELETE FROM app.fan_submission_contributions',
        'TRUNCATE app.fan_submission_selections',
        'UPDATE app.fan_interaction_sessions SET created_by=created_by',
        'UPDATE app.photo_activity_claims SET confidence=confidence',
        'DELETE FROM app.photo_activity_claims',
        'TRUNCATE app.photo_activity_claims',
        'SET ROLE amr_migration_owner',
      ])
        await assert.rejects(runtime.query(sql), (e) => e.code === '42501');
      for (const role of ['anon', 'authenticated']) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(`SET LOCAL ROLE ${role}`);
          await assert.rejects(
            client.query('SELECT * FROM app.fan_submission_selections'),
            (e) => e.code === '42501',
          );
        } finally {
          await client.query('ROLLBACK');
          client.release();
        }
      }
      if (targetCount === 11) {
        // The real runtime can mutate only the owner's exact AI columns.
        await runtime.query(
          "INSERT INTO app.ai_cost_operations(operation_id,scope,fingerprint,reservation,rate_expires_at_ms) VALUES('fixture-operation','amr-tokenrouter-dev-and-demo',repeat('d',64),'{}',1)",
        );
        await runtime.query(
          "INSERT INTO app.ai_cost_calls(operation_id,call_id,reserved_nano_usd,accounted_nano_usd) VALUES('fixture-operation','fixture-call',10,10)",
        );
        await runtime.query(
          "UPDATE app.ai_cost_calls SET state='disputed',accounted_nano_usd=1,bound_exceeded=false WHERE operation_id='fixture-operation'",
        );
        await runtime.query(
          'UPDATE app.ai_cost_budget SET committed_nano_usd=11000000000,suspended=true',
        );
        for (const sql of [
          "INSERT INTO app.ai_cost_budget(scope) VALUES('amr-tokenrouter-dev-and-demo')",
          'UPDATE app.ai_cost_budget SET cap_nano_usd=cap_nano_usd',
          'UPDATE app.ai_cost_budget SET scope=scope',
          'UPDATE app.ai_cost_operations SET reservation=reservation',
          'UPDATE app.ai_cost_calls SET reserved_nano_usd=reserved_nano_usd',
          "INSERT INTO app.ai_cost_operations(operation_id,scope,fingerprint,reservation,rate_expires_at_ms,created_at) VALUES('forbidden','amr-tokenrouter-dev-and-demo',repeat('e',64),'{}',1,now())",
          "INSERT INTO app.ai_cost_calls(operation_id,call_id,reserved_nano_usd,accounted_nano_usd,state) VALUES('fixture-operation','forbidden',1,1,'held')",
          ...['ai_cost_budget', 'ai_cost_operations', 'ai_cost_calls'].flatMap(
            (table) => [`DELETE FROM app.${table}`, `TRUNCATE app.${table}`],
          ),
        ])
          await assert.rejects(
            runtime.query(sql),
            (error) => error.code === '42501',
          );
        const budgetBeforeReplay = (
          await runtime.query('SELECT * FROM app.ai_cost_budget')
        ).rows;
        const callsBeforeReplay = (
          await runtime.query('SELECT * FROM app.ai_cost_calls')
        ).rows;
        const operationsBeforeReplay = (
          await runtime.query('SELECT * FROM app.ai_cost_operations')
        ).rows;
        await assert.rejects(
          bootstrapDatabase(deployer, password, {
            targetMigration: '0010_photo_activity.sql',
          }),
          /Migration checksum collision/,
        );
        assert.deepEqual(
          (
            await pool.query(
              'SELECT * FROM public.schema_migrations ORDER BY name',
            )
          ).rows,
          upgradedHistory,
        );
        // Replay requires no initialization assertion and ignores the supplied password.
        assert.deepEqual(await bootstrapDatabase(deployer, 'x'.repeat(48)), {
          state: 'unchanged',
          migrations: targetCount,
        });
        assert.deepEqual(
          (await runtime.query('SELECT * FROM app.ai_cost_budget')).rows,
          budgetBeforeReplay,
        );
        assert.deepEqual(
          (await runtime.query('SELECT * FROM app.ai_cost_calls')).rows,
          callsBeforeReplay,
        );
        assert.deepEqual(
          (await runtime.query('SELECT * FROM app.ai_cost_operations')).rows,
          operationsBeforeReplay,
        );
      } else {
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relname LIKE 'ai_cost_%'",
            )
          ).rows[0].n,
          0,
        );
        await assert.rejects(
          bootstrapDatabase(deployer, password),
          /AI budget initialization requires/,
        );
        assert.deepEqual(
          (
            await pool.query(
              'SELECT * FROM public.schema_migrations ORDER BY name',
            )
          ).rows,
          upgradedHistory,
        );
      }
      assert.deepEqual(await bootstrapDatabase(deployer, password, options), {
        state: 'unchanged',
        migrations: targetCount,
      });
      await pool.query(
        `GRANT DELETE ON app.fan_submission_contributions TO ${RUNTIME}`,
      );
      await assert.rejects(
        bootstrapDatabase(deployer, password, options),
        /participation privilege/i,
      );
      await pool.query(
        `REVOKE DELETE ON app.fan_submission_contributions FROM ${RUNTIME}`,
      );
      await pool.query(
        'UPDATE public.schema_migrations SET checksum=repeat($1,64) WHERE name=$2',
        ['0', migration],
      );
      await assert.rejects(
        bootstrapDatabase(deployer, password, options),
        /checksum/i,
      );
      await pool.query(
        'UPDATE public.schema_migrations SET checksum=$1 WHERE name=$2',
        [checksum, migration],
      );
      for (const [grant, revoke] of [
        [
          'GRANT MAINTAIN ON app.photo_activity_claims TO amr_api',
          'REVOKE MAINTAIN ON app.photo_activity_claims FROM amr_api',
        ],
        [
          'GRANT UPDATE(reservation) ON app.ai_cost_operations TO amr_api',
          'REVOKE UPDATE(reservation) ON app.ai_cost_operations FROM amr_api',
        ],
        [
          'GRANT INSERT ON app.ai_cost_budget TO amr_api',
          'REVOKE INSERT ON app.ai_cost_budget FROM amr_api',
        ],
        [
          'GRANT INSERT(state) ON app.ai_cost_calls TO amr_api',
          'REVOKE INSERT(state) ON app.ai_cost_calls FROM amr_api',
        ],
        [
          'GRANT UPDATE(suspended) ON app.ai_cost_budget TO amr_api WITH GRANT OPTION',
          'REVOKE GRANT OPTION FOR UPDATE(suspended) ON app.ai_cost_budget FROM amr_api',
        ],
        [
          'GRANT SELECT ON app.ai_cost_calls TO PUBLIC',
          'REVOKE SELECT ON app.ai_cost_calls FROM PUBLIC',
        ],

        [
          'GRANT UPDATE(confidence) ON app.photo_activity_claims TO amr_api',
          'REVOKE UPDATE(confidence) ON app.photo_activity_claims FROM amr_api',
        ],
        [
          'GRANT SELECT ON app.photo_activity_claims TO amr_api WITH GRANT OPTION',
          'REVOKE GRANT OPTION FOR SELECT ON app.photo_activity_claims FROM amr_api',
        ],
        [
          'GRANT SELECT(id) ON app.photo_activity_claims TO PUBLIC',
          'REVOKE SELECT(id) ON app.photo_activity_claims FROM PUBLIC',
        ],
        [
          'GRANT SELECT ON app.photo_activity_claims TO anon',
          'REVOKE SELECT ON app.photo_activity_claims FROM anon',
        ],
      ].filter(
        ([grant]) => targetCount === 11 || !grant.includes('ai_cost_'),
      )) {
        await pool.query(grant);
        try {
          const before = (
            await pool.query(
              "SELECT relacl::text FROM pg_class WHERE oid='app.photo_activity_claims'::regclass",
            )
          ).rows;
          await assert.rejects(
            bootstrapDatabase(deployer, password, options),
            /privilege collision/i,
          );
          assert.deepEqual(
            (
              await pool.query(
                "SELECT relacl::text FROM pg_class WHERE oid='app.photo_activity_claims'::regclass",
              )
            ).rows,
            before,
          );
          assert.deepEqual(
            (
              await pool.query(
                'SELECT * FROM public.schema_migrations ORDER BY name',
              )
            ).rows,
            upgradedHistory,
          );
        } finally {
          await pool.query(revoke);
        }
      }
      assert.deepEqual(await bootstrapDatabase(deployer, password, options), {
        state: 'unchanged',
        migrations: targetCount,
      });
    } finally {
      await runtime.end();
      await deployer.end();
      await pool.query(
        'DROP EVENT TRIGGER IF EXISTS upgrade_fail; DROP FUNCTION IF EXISTS public.upgrade_fail(); DROP SCHEMA IF EXISTS app CASCADE; DROP TABLE IF EXISTS public.schema_migrations,public.peer_data',
      );
      for (const role of [
        'upgrade_deployer',
        RUNTIME,
        OWNER,
        'anon',
        'authenticated',
      ])
        if (
          (await pool.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]))
            .rowCount
        )
          await pool.query(`DROP OWNED BY ${role} CASCADE; DROP ROLE ${role}`);
      await pool.end();
    }
  });
}
