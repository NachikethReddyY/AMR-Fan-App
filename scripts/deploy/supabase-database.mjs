import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const OWNER = 'amr_migration_owner';
export const RUNTIME = 'amr_api';
const project = 'folakoxsilrfemctvlxj';
const migrationNames = [
  '0001_application.sql',
  '0002_accounts.sql',
  '0003_points_history.sql',
  '0004_journeys.sql',
  '0005_fan_submissions.sql',
  '0006_rewards.sql',
  '0007_reports.sql',
  '0008_journey_awards.sql',
  '0009_submission_participation.sql',
];
const participationTables = [
  'fan_submission_contributions',
  'fan_submission_admin_actions',
  'fan_interaction_sessions',
  'fan_submission_selections',
];
const participationFunctions = [
  'protect_participation_history',
  'close_interaction_once',
  'resolve_selection_once',
];
const root = fileURLToPath(new URL('../../', import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const databaseCreateRefusal =
  'Runtime has effective database CREATE. Have the database owner review direct and PUBLIC grants before retrying; bootstrap will not revoke shared rights.';

export function deploymentConnection(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    input.projectRef !== project ||
    typeof input.connectionString !== 'string' ||
    typeof input.runtimePassword !== 'string' ||
    !/^[A-Za-z0-9_-]{48,128}$/.test(input.runtimePassword)
  )
    throw new Error('Invalid deployment configuration.');
  const url = new URL(input.connectionString);
  if (
    url.protocol !== 'postgresql:' ||
    url.username !== `postgres.${project}` ||
    !/^aws-[0-9]+-ap-south-1\.pooler\.supabase\.com$/.test(url.hostname) ||
    url.port !== '5432' ||
    url.pathname !== '/postgres' ||
    !url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Only the exact Supabase project session-pooler connection is permitted.',
    );
  return {
    connectionString: url.href,
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  };
}

/** Atomic setup only; never resets, rotates passwords, seeds or rewrites migrations. */
export async function bootstrapDatabase(pool, runtimePassword) {
  if (!/^[A-Za-z0-9_-]{48,128}$/.test(runtimePassword))
    throw new Error('Invalid runtime credential.');
  const migrations = await Promise.all(
    migrationNames.map(async (name) => {
      const sql = await readFile(
        new URL(`../../server/database/migrations/${name}`, import.meta.url),
        'utf8',
      );
      return { name, sql, checksum: digest(sql) };
    }),
  );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(48136291)');
    const state = (
      await client.query(`SELECT to_regnamespace('app') IS NOT NULL AS app,
      to_regclass('public.schema_migrations') IS NOT NULL AS ledger,
      (SELECT count(*)::int FROM pg_roles WHERE rolname IN ('amr_migration_owner','amr_api')) AS roles`)
    ).rows[0];
    if (state.app || state.ledger || state.roles) {
      if (!state.app || !state.ledger || state.roles !== 2)
        throw new Error('Deployment resource collision.');
      const history = (
        await client.query(
          'SELECT name,checksum FROM public.schema_migrations ORDER BY name',
        )
      ).rows;
      if (
        ![8, migrations.length].includes(history.length) ||
        history.some(
          (m, i) =>
            m.name !== migrations[i].name ||
            m.checksum !== migrations[i].checksum,
        )
      )
        throw new Error('Migration checksum collision.');
      await verifyPrivileges(client);
      if (history.length === 8) {
        await client.query(`SET LOCAL ROLE ${OWNER}`);
        const { name, sql, checksum } = migrations[8];
        await client.query(sql);
        await grantParticipation(client);
        await client.query(
          'INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)',
          [name, checksum],
        );
        await client.query('RESET ROLE');
        await verifyPrivileges(client);
      }
      await verifyParticipationPrivileges(client);
      await client.query('COMMIT');
      return {
        state: history.length === 8 ? 'upgraded' : 'unchanged',
        migrations: migrations.length,
      };
    }
    await client.query(
      `CREATE ROLE ${OWNER} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
    await client.query(
      `CREATE ROLE ${RUNTIME} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${pg.escapeLiteral(runtimePassword)}`,
    );
    const actor = (await client.query('SELECT current_user AS name')).rows[0]
      .name;
    await client.query(`GRANT ${OWNER} TO ${pg.escapeIdentifier(actor)}`);
    await client.query(
      `GRANT CREATE ON DATABASE ${pg.escapeIdentifier((await client.query('SELECT current_database() AS name')).rows[0].name)} TO ${OWNER}`,
    );
    await client.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${OWNER}`);
    await client.query(`SET LOCAL ROLE ${OWNER}`);
    await client.query(
      'CREATE TABLE public.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const { name, sql, checksum } of migrations) {
      await client.query(sql);
      await client.query(
        'INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)',
        [name, checksum],
      );
    }
    await client.query(
      `REVOKE ALL ON SCHEMA app FROM PUBLIC; REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC; REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM PUBLIC; REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC`,
    );
    for (const name of ['anon', 'authenticated'])
      if (
        (await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [name]))
          .rowCount
      ) {
        await client.query(
          `REVOKE ALL ON SCHEMA app FROM ${name}; REVOKE ALL ON ALL TABLES IN SCHEMA app FROM ${name}; REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM ${name}; REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM ${name}`,
        );
      }
    await client.query(
      `GRANT USAGE ON SCHEMA app TO ${RUNTIME}; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA app TO ${RUNTIME}; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA app TO ${RUNTIME}; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO ${RUNTIME}`,
    );
    await client.query(
      `REVOKE INSERT,UPDATE,DELETE ON app.principals,app.role_assignments FROM ${RUNTIME}; GRANT INSERT(issuer,subject),UPDATE(subject) ON app.principals TO ${RUNTIME}; REVOKE ALL ON public.schema_migrations FROM PUBLIC,${RUNTIME}`,
    );
    await grantParticipation(client);
    await client.query('RESET ROLE');
    await client.query(
      `REVOKE CREATE ON SCHEMA public FROM ${OWNER}; REVOKE CREATE ON DATABASE ${pg.escapeIdentifier((await client.query('SELECT current_database() AS name')).rows[0].name)} FROM ${OWNER}`,
    );
    await verifyPrivileges(client);
    await verifyParticipationPrivileges(client);
    await client.query('COMMIT');
    return { state: 'created', migrations: migrations.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function grantParticipation(client) {
  const tables = participationTables.map((name) => `app.${name}`).join(',');
  const functions = participationFunctions
    .map((name) => `app.${name}()`)
    .join(',');
  const sequence = 'app.fan_interaction_sessions_sequence_seq';
  const denied = ['PUBLIC', RUNTIME];
  for (const name of ['anon', 'authenticated'])
    if (
      (await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [name]))
        .rowCount
    )
      denied.push(name);
  await client.query(
    `REVOKE ALL ON ${tables} FROM ${denied.join(',')};
     REVOKE ALL ON SEQUENCE ${sequence} FROM ${denied.join(',')};
     REVOKE ALL ON FUNCTION ${functions} FROM ${denied.join(',')};
     GRANT SELECT,INSERT ON ${tables} TO ${RUNTIME};
     GRANT UPDATE(closed_by,closed_at,closed_action_id) ON app.fan_interaction_sessions TO ${RUNTIME};
     GRANT UPDATE(status,resolved_by,resolved_at,reason,resolved_action_id) ON app.fan_submission_selections TO ${RUNTIME};
     GRANT USAGE,SELECT ON SEQUENCE ${sequence} TO ${RUNTIME};
     GRANT EXECUTE ON FUNCTION ${functions} TO ${RUNTIME}`,
  );
}

async function verifyParticipationPrivileges(client) {
  for (const table of participationTables) {
    const permissions = (
      await client.query(
        `SELECT has_table_privilege($1,$2,'SELECT') AS read,
       has_table_privilege($1,$2,'INSERT') AS insert,
       has_table_privilege($1,$2,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS elevated`,
        [RUNTIME, `app.${table}`],
      )
    ).rows[0];
    if (!permissions.read || !permissions.insert || permissions.elevated)
      throw new Error('Participation privilege collision.');
  }
  const columns = {
    fan_interaction_sessions: ['closed_by', 'closed_at', 'closed_action_id'],
    fan_submission_selections: [
      'status',
      'resolved_by',
      'resolved_at',
      'reason',
      'resolved_action_id',
    ],
  };
  for (const table of participationTables) {
    const rows = (
      await client.query(
        `SELECT a.attname,has_column_privilege($1,a.attrelid,a.attnum,'UPDATE') AS allowed
       FROM pg_attribute a WHERE a.attrelid=$2::regclass AND a.attnum>0 AND NOT a.attisdropped`,
        [RUNTIME, `app.${table}`],
      )
    ).rows;
    if (
      rows.some(
        (row) => row.allowed !== (columns[table] ?? []).includes(row.attname),
      )
    )
      throw new Error('Participation privilege collision.');
  }
  const sequence = (
    await client.query(
      `SELECT has_sequence_privilege($1,'app.fan_interaction_sessions_sequence_seq','USAGE') AS usage,
     has_sequence_privilege($1,'app.fan_interaction_sessions_sequence_seq','SELECT') AS read,
     has_sequence_privilege($1,'app.fan_interaction_sessions_sequence_seq','UPDATE') AS write`,
      [RUNTIME],
    )
  ).rows[0];
  if (!sequence.usage || !sequence.read || sequence.write)
    throw new Error('Participation privilege collision.');
  for (const name of participationFunctions) {
    const fn = (
      await client.query(
        `SELECT pg_get_userbyid(proowner) AS owner,has_function_privilege($1,oid,'EXECUTE') AS execute,
       EXISTS(SELECT 1 FROM aclexplode(COALESCE(proacl,acldefault('f',proowner))) WHERE grantee=0 AND privilege_type='EXECUTE') AS public
       FROM pg_proc WHERE oid=$2::regprocedure`,
        [RUNTIME, `app.${name}()`],
      )
    ).rows[0];
    if (!fn || fn.owner !== OWNER || !fn.execute || fn.public)
      throw new Error('Participation privilege collision.');
  }
}

async function verifyPrivileges(client) {
  if (
    (
      await client.query(
        "SELECT has_database_privilege($1,current_database(),'CREATE') AS create",
        [RUNTIME],
      )
    ).rows[0].create
  )
    throw new Error(databaseCreateRefusal);
  const elevated = (
    await client.query(
      `SELECT
    has_column_privilege($1,'app.principals','role','INSERT,UPDATE') AS role,
    has_table_privilege($1,'app.role_assignments','INSERT,UPDATE,DELETE,TRUNCATE') AS assignments,
    has_schema_privilege($1,'public','CREATE') AS public_create`,
      [RUNTIME],
    )
  ).rows[0];
  if (Object.values(elevated).some(Boolean))
    throw new Error('Runtime privilege collision.');
  const roles = (
    await client.query(
      'SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=ANY($1)',
      [[OWNER, RUNTIME]],
    )
  ).rows;
  if (
    roles.length !== 2 ||
    roles.some(
      (r) =>
        r.rolcanlogin !== (r.rolname === RUNTIME) ||
        r.rolsuper ||
        r.rolcreatedb ||
        r.rolcreaterole ||
        r.rolreplication ||
        r.rolbypassrls,
    )
  )
    throw new Error('Role privilege collision.');
  if (
    (
      await client.query(
        `SELECT 1 FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname=ANY($1)) OR (roleid IN (SELECT oid FROM pg_roles WHERE rolname=ANY($1)) AND member<>(SELECT oid FROM pg_roles WHERE rolname=current_user))`,
        [[OWNER, RUNTIME]],
      )
    ).rowCount
  )
    throw new Error('Role membership collision.');
  const owners = (
    await client.query(`SELECT pg_get_userbyid(n.nspowner) AS owner FROM pg_namespace n WHERE n.nspname='app'
    UNION ALL SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' OR (n.nspname='public' AND c.relname='schema_migrations')`)
  ).rows;
  if (!owners.length || owners.some((r) => r.owner !== OWNER))
    throw new Error('Schema ownership collision.');
  for (const name of ['anon', 'authenticated', RUNTIME]) {
    if (
      !(await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [name]))
        .rowCount
    )
      continue;
    const permissions = (
      await client.query(
        `SELECT has_schema_privilege($1,'app','USAGE') AS usage,has_schema_privilege($1,'app','CREATE') AS create,has_table_privilege($1,'public.schema_migrations','INSERT,UPDATE,DELETE,TRUNCATE') AS ledger`,
        [name],
      )
    ).rows[0];
    if (
      permissions.usage !== (name === RUNTIME) ||
      permissions.create ||
      permissions.ledger
    )
      throw new Error('Namespace privilege collision.');
  }
}

async function main() {
  if (
    process.argv.length !== 5 ||
    process.argv[2] !== 'prepare' ||
    process.argv[3] !== '--config'
  )
    throw new Error(
      'Usage: node scripts/deploy/supabase-database.mjs prepare --config PRIVATE_JSON',
    );
  const path = await realpath(process.argv[4]);
  const rel = relative(await realpath(root), path);
  if (
    !(rel === '..' || rel.startsWith('../')) ||
    (await lstat(process.argv[4])).isSymbolicLink()
  )
    throw new Error(
      'Configuration must be private and outside the repository.',
    );
  if (
    !(await lstat(path)).isFile() ||
    (await lstat(path)).size > 16384 ||
    (await lstat(path)).mode % 512 !== 384 ||
    (await lstat(dirname(path))).mode % 512 !== 448
  )
    throw new Error('Configuration requires file0600 and directory0700.');
  const input = JSON.parse(await readFile(path, 'utf8'));
  const pool = new pg.Pool(deploymentConnection(input));
  try {
    process.stdout.write(
      JSON.stringify(await bootstrapDatabase(pool, input.runtimePassword)) +
        '\n',
    );
  } finally {
    await pool.end();
  }
}
if (
  process.argv[1] &&
  existsSync(resolve(process.argv[1])) &&
  realpathSync.native(resolve(process.argv[1])) ===
    realpathSync.native(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    process.stderr.write(
      error instanceof Error && error.message === databaseCreateRefusal
        ? databaseCreateRefusal + '\n'
        : 'Database preparation refused or failed; no credentials are printed.\n',
    );
    process.exitCode = 1;
  });
}
