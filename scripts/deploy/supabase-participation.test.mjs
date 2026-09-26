import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import pg from 'pg';
import { bootstrapDatabase, OWNER, RUNTIME } from './supabase-database.mjs';

if (process.env.AMR_OPS123_DISPOSABLE !== 'true')
  throw new Error('Owned disposable container required.');
const password = (await readFile('/run/amr-test/password', 'utf8')).trim();
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
  max: 1,
});
const migration = '0009_submission_participation.sql';

async function previousInstallation() {
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
    const dir = new URL('../../server/database/migrations/', import.meta.url);
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
    await client.query('COMMIT');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

test('retained eight-migration installation upgrades atomically with restricted participation access', async () => {
  try {
    // A retained 0001-0008 ledger, with existing owner/runtime roles and data.
    await previousInstallation();
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

    await pool.query(
      'UPDATE public.schema_migrations SET checksum=repeat($1,64) WHERE name=$2',
      ['0', history[0].name],
    );
    await assert.rejects(bootstrapDatabase(deployer, password), /checksum/i);
    await pool.query(
      'UPDATE public.schema_migrations SET checksum=$1 WHERE name=$2',
      [history[0].checksum, history[0].name],
    );
    await pool.query(
      'CREATE TABLE app.fan_submission_selections(collision int); INSERT INTO app.fan_submission_selections VALUES(19)',
    );
    await assert.rejects(
      bootstrapDatabase(deployer, password),
      /ownership collision/i,
    );
    await pool.query(
      `ALTER TABLE app.fan_submission_selections OWNER TO ${OWNER}`,
    );
    await assert.rejects(
      bootstrapDatabase(deployer, password),
      /already exists/i,
    );
    assert.equal(
      (await pool.query('SELECT collision FROM app.fan_submission_selections'))
        .rows[0].collision,
      19,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT to_regclass('app.fan_submission_contributions') IS NULL absent",
        )
      ).rows[0].absent,
      true,
    );
    assert.deepEqual(
      (await pool.query('SELECT * FROM public.schema_migrations ORDER BY name'))
        .rows,
      history,
    );
    await pool.query('DROP TABLE app.fan_submission_selections');
    await pool.query(
      "CREATE FUNCTION public.upgrade_fail() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'late participation failure'; END $$; CREATE EVENT TRIGGER upgrade_fail ON ddl_command_end WHEN TAG IN ('CREATE TRIGGER') EXECUTE FUNCTION public.upgrade_fail()",
    );
    await assert.rejects(
      bootstrapDatabase(deployer, password),
      /late participation failure/,
    );
    await pool.query(
      'DROP EVENT TRIGGER upgrade_fail; DROP FUNCTION public.upgrade_fail()',
    );
    assert.equal(
      (
        await pool.query(
          "SELECT to_regclass('app.fan_submission_contributions') IS NULL absent",
        )
      ).rows[0].absent,
      true,
    );
    assert.deepEqual(
      (await pool.query('SELECT * FROM public.schema_migrations ORDER BY name'))
        .rows,
      history,
    );
    assert.deepEqual(await bootstrapDatabase(deployer, password), {
      state: 'upgraded',
      migrations: 9,
    });
    assert.deepEqual(
      (
        await pool.query(
          'SELECT * FROM public.schema_migrations WHERE name<>$1 ORDER BY name',
          [migration],
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
    const checksum = createHash('sha256')
      .update(
        await readFile(
          new URL(
            `../../server/database/migrations/${migration}`,
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
    assert.deepEqual(await bootstrapDatabase(deployer, password), {
      state: 'unchanged',
      migrations: 9,
    });
    await pool.query(
      `GRANT DELETE ON app.fan_submission_contributions TO ${RUNTIME}`,
    );
    await assert.rejects(
      bootstrapDatabase(deployer, password),
      /participation privilege/i,
    );
    await pool.query(
      `REVOKE DELETE ON app.fan_submission_contributions FROM ${RUNTIME}`,
    );
    await pool.query(
      'UPDATE public.schema_migrations SET checksum=repeat($1,64) WHERE name=$2',
      ['0', migration],
    );
    await assert.rejects(bootstrapDatabase(deployer, password), /checksum/i);
    await pool.query(
      'UPDATE public.schema_migrations SET checksum=$1 WHERE name=$2',
      [checksum, migration],
    );
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
