import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import pg from 'pg';
import {
  bootstrapDatabase,
  deploymentConnection,
  OWNER,
  RUNTIME,
} from './supabase-database.mjs';

// This test only runs inside the owned, labelled disposable fixture container.
if (process.env.AMR_OPS123_DISPOSABLE !== 'true')
  throw new Error('Disposable container required.');
const password = await readFile('/run/amr-test/password', 'utf8');
const pool = new pg.Pool({
  host: '127.0.0.1',
  database: 'postgres',
  user: 'postgres',
  password: password.trim(),
  max: 2,
});
const runtime = new pg.Pool({
  host: '127.0.0.1',
  database: 'postgres',
  user: RUNTIME,
  password: password.trim(),
  max: 2,
});
const deployer = new pg.Pool({
  host: '127.0.0.1',
  database: 'postgres',
  user: 'ops123_admin',
  password: password.trim(),
  max: 1,
});
const q = (sql, values) => pool.query(sql, values);
test('bootstrap collision rollback, ownership, replay and actual restricted connections', async (t) => {
  try {
    await q(
      'CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE TABLE public.peer_data(id integer); INSERT INTO public.peer_data VALUES(17)',
    );
    await q(
      `CREATE ROLE ops123_admin LOGIN CREATEROLE PASSWORD ${pg.escapeLiteral(password.trim())}; GRANT CREATE ON DATABASE postgres TO ops123_admin WITH GRANT OPTION; GRANT USAGE,CREATE ON SCHEMA public TO ops123_admin WITH GRANT OPTION`,
    );
    await q('CREATE SCHEMA app');
    await assert.rejects(
      bootstrapDatabase(deployer, password.trim()),
      /collision/i,
    );
    assert.equal(
      (
        await q(
          'SELECT count(*)::int n FROM pg_roles WHERE rolname = ANY($1)',
          [[OWNER, RUNTIME]],
        )
      ).rows[0].n,
      0,
    );
    await q('DROP SCHEMA app');
    await q(`CREATE ROLE ${OWNER} NOLOGIN`);
    await assert.rejects(
      bootstrapDatabase(deployer, password.trim()),
      /collision/i,
    );
    await q(`DROP ROLE ${OWNER}`);
    await q(`CREATE FUNCTION public.ops123_fail() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture late migration failure'; END $$;
      CREATE EVENT TRIGGER ops123_fail ON ddl_command_start WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION public.ops123_fail()`);
    await assert.rejects(
      bootstrapDatabase(deployer, password.trim()),
      /fixture late migration failure/,
    );
    await q(
      'DROP EVENT TRIGGER ops123_fail; DROP FUNCTION public.ops123_fail()',
    );
    assert.equal(
      (
        await q(
          'SELECT count(*)::int n FROM pg_roles WHERE rolname = ANY($1)',
          [[OWNER, RUNTIME]],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await q("SELECT to_regnamespace('app') IS NULL absent")).rows[0].absent,
      true,
    );
    assert.equal(
      (await bootstrapDatabase(deployer, password.trim())).state,
      'created',
    );
    assert.equal(
      (await runtime.query('SELECT current_user AS name')).rows[0].name,
      RUNTIME,
    );
    const history = (
      await q(
        'SELECT name,checksum FROM public.schema_migrations ORDER BY name',
      )
    ).rows;
    assert.equal(history.length, 9);
    assert.equal(
      (
        await q(
          `SELECT pg_get_userbyid(nspowner) owner FROM pg_namespace WHERE nspname='app'`,
        )
      ).rows[0].owner,
      OWNER,
    );
    const role = (
      await q(
        'SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1',
        [RUNTIME],
      )
    ).rows[0];
    assert.ok(Object.values(role).every((x) => x === false));
    assert.equal(
      (
        await q(
          'SELECT count(*)::int n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)',
          [RUNTIME],
        )
      ).rows[0].n,
      0,
    );
    await runtime.query(
      "INSERT INTO app.principals(issuer,subject) VALUES('urn:ops123','fan') ON CONFLICT(issuer,subject) DO UPDATE SET subject=excluded.subject",
    );
    for (const sql of [
      'CREATE SCHEMA ops123_forbidden',
      'CREATE TABLE app.forbidden(id integer)',
      'UPDATE public.schema_migrations SET checksum=checksum',
      "UPDATE app.principals SET role='admin'",
      'SET ROLE amr_migration_owner',
      "INSERT INTO app.role_assignments(principal_id,role,reason) SELECT id,'admin','forged' FROM app.principals",
    ])
      await assert.rejects(runtime.query(sql), (e) => e.code === '42501');
    for (const name of ['anon', 'authenticated']) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL ROLE ${name}`);
        await assert.rejects(
          client.query('SELECT * FROM app.principals'),
          (e) => e.code === '42501',
        );
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    }
    assert.equal(
      (await bootstrapDatabase(deployer, password.trim())).state,
      'unchanged',
    );
    assert.deepEqual(
      (
        await q(
          'SELECT name,checksum FROM public.schema_migrations ORDER BY name',
        )
      ).rows,
      history,
    );
    assert.equal(
      (await runtime.query('SELECT count(*)::int n FROM app.principals'))
        .rows[0].n,
      1,
    );
    // PostgreSQL's default PUBLIC TEMP right is separate from persistent DDL.
    assert.equal(
      (
        await runtime.query(
          "SELECT has_database_privilege(current_user,current_database(),'TEMP') AS temp",
        )
      ).rows[0].temp,
      true,
    );
    const temporary = await runtime.connect();
    try {
      await temporary.query('BEGIN');
      await temporary.query('CREATE TEMP TABLE ops123_temp_probe(id integer)');
    } finally {
      await temporary.query('ROLLBACK');
      assert.equal(
        (
          await temporary.query(
            "SELECT to_regclass('pg_temp.ops123_temp_probe') IS NULL AS absent",
          )
        ).rows[0].absent,
        true,
      );
      temporary.release();
    }
    for (const grantee of [RUNTIME, 'PUBLIC']) {
      await t.test(
        `replay rejects effective database CREATE through ${grantee}`,
        async () => {
          await q(`GRANT CREATE ON DATABASE postgres TO ${grantee}`);
          try {
            const acl = (
              await q(
                'SELECT datacl::text AS acl FROM pg_database WHERE datname=current_database()',
              )
            ).rows[0].acl;
            const client = await runtime.connect();
            try {
              assert.equal(
                (await client.query('SELECT current_user AS name')).rows[0]
                  .name,
                RUNTIME,
              );
              await client.query('BEGIN');
              await client.query(
                'CREATE SCHEMA ops123_create_probe; CREATE TABLE ops123_create_probe.proof(id integer); INSERT INTO ops123_create_probe.proof VALUES(1)',
              );
              assert.equal(
                (await client.query('SELECT id FROM ops123_create_probe.proof'))
                  .rows[0].id,
                1,
              );
            } finally {
              await client.query('ROLLBACK');
              client.release();
            }
            assert.equal(
              (
                await q(
                  "SELECT to_regnamespace('ops123_create_probe') IS NULL AS absent",
                )
              ).rows[0].absent,
              true,
            );
            t.diagnostic(
              `${grantee}: real runtime schema/table creation reproduced and rolled back`,
            );
            await assert.rejects(
              bootstrapDatabase(deployer, password.trim()),
              /effective database CREATE/i,
            );
            assert.equal(
              (
                await q(
                  'SELECT datacl::text AS acl FROM pg_database WHERE datname=current_database()',
                )
              ).rows[0].acl,
              acl,
            );
            assert.deepEqual(
              (
                await q(
                  'SELECT name,checksum FROM public.schema_migrations ORDER BY name',
                )
              ).rows,
              history,
            );
            assert.equal(
              (
                await runtime.query(
                  'SELECT count(*)::int n FROM app.principals',
                )
              ).rows[0].n,
              1,
            );
          } finally {
            // Restore only the deliberately added grant in this disposable fixture.
            await q(`REVOKE CREATE ON DATABASE postgres FROM ${grantee}`);
          }
          assert.equal(
            (await bootstrapDatabase(deployer, password.trim())).state,
            'unchanged',
          );
        },
      );
    }
    await q(
      "UPDATE public.schema_migrations SET checksum=repeat('0',64) WHERE name='0008_journey_awards.sql'",
    );
    await assert.rejects(
      bootstrapDatabase(deployer, password.trim()),
      /checksum/i,
    );
    assert.equal((await q('SELECT id FROM public.peer_data')).rows[0].id, 17);
    // Fixture-only restore permits downstream actual API authorization tests.
    await q('UPDATE public.schema_migrations SET checksum=$1 WHERE name=$2', [
      history[7].checksum,
      history[7].name,
    ]);
    await q(`GRANT UPDATE(role) ON app.principals TO ${RUNTIME}`);
    await assert.rejects(
      bootstrapDatabase(deployer, password.trim()),
      /privilege collision/i,
    );
    await q(`REVOKE UPDATE(role) ON app.principals FROM ${RUNTIME}`);
    // Fresh setup must also roll back every new role/object if PUBLIC grants CREATE.
    await q('DROP SCHEMA app CASCADE; DROP TABLE public.schema_migrations');
    await deployer.query(`REVOKE ALL ON SCHEMA public FROM ${OWNER}`);
    for (const name of [RUNTIME, OWNER])
      await q(`DROP OWNED BY ${name} CASCADE; DROP ROLE ${name}`);
    await q('GRANT CREATE ON DATABASE postgres TO PUBLIC');
    try {
      const acl = (
        await q(
          'SELECT datacl::text AS acl FROM pg_database WHERE datname=current_database()',
        )
      ).rows[0].acl;
      await assert.rejects(
        bootstrapDatabase(deployer, password.trim()),
        /effective database CREATE/i,
      );
      assert.equal(
        (
          await q(
            'SELECT count(*)::int n FROM pg_roles WHERE rolname=ANY($1)',
            [[OWNER, RUNTIME]],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await q(
            "SELECT to_regnamespace('app') IS NULL AND to_regclass('public.schema_migrations') IS NULL AS absent",
          )
        ).rows[0].absent,
        true,
      );
      assert.equal(
        (
          await q(
            'SELECT datacl::text AS acl FROM pg_database WHERE datname=current_database()',
          )
        ).rows[0].acl,
        acl,
      );
      assert.equal((await q('SELECT id FROM public.peer_data')).rows[0].id, 17);
      t.diagnostic(
        'Fresh PUBLIC CREATE rejection rolls back roles, migrations and ledger; database ACL and peer data preserved',
      );
    } finally {
      await q('REVOKE CREATE ON DATABASE postgres FROM PUBLIC');
    }
  } finally {
    await runtime.end();
    await deployer.end();
    // Only the dedicated fixture; no retained database is reachable here.
    await q(
      'DROP SCHEMA IF EXISTS app CASCADE; DROP TABLE IF EXISTS public.schema_migrations,public.peer_data; DROP EVENT TRIGGER IF EXISTS ops123_fail; DROP FUNCTION IF EXISTS public.ops123_fail()',
    );
    for (const name of [
      'ops123_admin',
      RUNTIME,
      OWNER,
      'anon',
      'authenticated',
    ]) {
      if ((await q('SELECT 1 FROM pg_roles WHERE rolname=$1', [name])).rowCount)
        await q(`DROP OWNED BY ${name} CASCADE; DROP ROLE ${name}`);
    }
    await pool.end();
  }
});
test('deployment connection pins project and session pooler, TLS and credential-free errors', () => {
  const input = {
    projectRef: 'folakoxsilrfemctvlxj',
    connectionString:
      'postgresql://postgres.folakoxsilrfemctvlxj:example@aws-1-ap-south-1.pooler.supabase.com:5432/postgres',
    runtimePassword: 'a'.repeat(48),
  };
  assert.equal(deploymentConnection(input).ssl.rejectUnauthorized, true);
  for (const change of [
    { projectRef: 'other' },
    {
      connectionString: 'postgres://postgres:example@127.0.0.1:55432/postgres',
    },
    { connectionString: input.connectionString + '?sslmode=disable' },
    { connectionString: input.connectionString.replace(':5432', ':6543') },
    {
      connectionString: input.connectionString.replace(
        'postgres.folak',
        'postgres.otherfolak',
      ),
    },
    { runtimePassword: 'short' },
  ])
    assert.throws(() => deploymentConnection({ ...input, ...change }));
});
