import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { migrate } from './migrate.ts';

const ADMIN = 'amr_staging_admin';
const RUNTIME = 'amr_api';
const DIGEST = (value) => createHash('sha256').update(value).digest('hex');

async function inPhase(name, operation) {
  try {
    return await operation();
  } catch (error) {
    const code =
      error && typeof error === 'object' &&
      typeof error.code === 'string' &&
      /^[A-Z0-9_]+$/.test(error.code)
        ? error.code
        : 'validation';
    throw new Error(`${name} failed (${code})`);
  }
}

export function migrationConfig(env = process.env) {
  const connectionString = env.AZURE_MIGRATION_DATABASE_URL;
  const runtimePassword = env.AZURE_RUNTIME_DATABASE_PASSWORD;
  if (!connectionString || !runtimePassword)
    throw new Error('Migration credentials must be supplied through the process environment.');
  if (!/^[A-Za-z0-9_-]{48,128}$/.test(runtimePassword))
    throw new Error('Runtime password must be a random 48-128 character value.');
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('Migration URL must be a PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('Migration URL must be a PostgreSQL URL.');
  if (url.username !== ADMIN || !url.password)
    throw new Error(`Migration URL must use ${ADMIN} with a password.`);
  if (url.search || url.hash)
    throw new Error('Migration URL must not contain query or fragment parameters.');
  if (url.pathname !== '/postgres')
    throw new Error('Migration URL must target the fresh postgres database.');
  if (!url.hostname.toLowerCase().endsWith('.postgres.database.azure.com'))
    throw new Error('Migration URL must target an Azure PostgreSQL Flexible Server.');
  return { url, runtimePassword };
}

function poolFor(url, applicationName) {
  return new pg.Pool({
    connectionString: url.href,
    ssl: { rejectUnauthorized: true },
    max: 2,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    application_name: applicationName,
  });
}

async function inspectRuntimeRole(client) {
  return (
    await client.query(
      `SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
              rolreplication, rolbypassrls, rolinherit
         FROM pg_roles WHERE rolname = $1`,
      [RUNTIME],
    )
  ).rows[0];
}

async function ensureRuntimeRole(client, password) {
  const state = await inspectRuntimeRole(client);
  if (!state) {
    await client.query(
      `CREATE ROLE ${RUNTIME} LOGIN NOINHERIT PASSWORD ${pg.escapeLiteral(password)}
       NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
  } else {
    if (
      !state.rolcanlogin ||
      state.rolsuper ||
      state.rolcreatedb ||
      state.rolcreaterole ||
      state.rolreplication ||
      state.rolbypassrls
    )
      throw new Error('Existing amr_api role has unsafe privilege flags.');
    await client.query(
      `ALTER ROLE ${RUNTIME} LOGIN NOINHERIT PASSWORD ${pg.escapeLiteral(password)}`,
    );
  }
  const memberships = await client.query(
    `SELECT 1
       FROM pg_auth_members membership
       JOIN pg_roles subject ON subject.oid = membership.member
      WHERE subject.rolname = $1`,
    [RUNTIME],
  );
  if (memberships.rowCount) throw new Error('Existing amr_api role has role memberships.');
}

async function applyRuntimeGrants(client) {
  const database = (await client.query('SELECT current_database() AS name')).rows[0]
    ?.name;
  if (typeof database !== 'string' || !database)
    throw new Error('Could not identify the migration database.');
  await client.query(`
    REVOKE CREATE ON DATABASE ${pg.escapeIdentifier(database)} FROM PUBLIC;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    REVOKE ALL ON SCHEMA app FROM PUBLIC, ${RUNTIME};
    REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM PUBLIC;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
    GRANT USAGE ON SCHEMA app TO ${RUNTIME};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO ${RUNTIME};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO ${RUNTIME};
    REVOKE ALL ON public.schema_migrations FROM PUBLIC, ${RUNTIME};
    GRANT SELECT ON public.schema_migrations TO ${RUNTIME};
    REVOKE INSERT, UPDATE, DELETE ON app.principals, app.role_assignments FROM ${RUNTIME};
    GRANT INSERT (issuer, subject), UPDATE (subject) ON app.principals TO ${RUNTIME};
  `);
}

async function assertDenied(client, sql, label) {
  await client.query('SAVEPOINT amr_privilege_probe');
  try {
    await client.query(sql);
    throw new Error(`Runtime privilege probe unexpectedly succeeded: ${label}`);
  } catch (error) {
    if (error?.code !== '42501') throw error;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT amr_privilege_probe');
    await client.query('RELEASE SAVEPOINT amr_privilege_probe');
  }
}

async function verifyRoleFlags(adminPool) {
  const { rows } = await adminPool.query(
    `SELECT r.rolcanlogin, r.rolsuper, r.rolcreatedb, r.rolcreaterole,
            r.rolreplication, r.rolbypassrls,
            has_database_privilege($1, current_database(), 'CREATE') AS database_create,
            EXISTS (
              SELECT 1 FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE pg_get_userbyid(c.relowner) = $1
                AND (n.nspname = 'app' OR (n.nspname = 'public' AND c.relname = 'schema_migrations'))
            ) AS owns_application_tables,
            EXISTS (
              SELECT 1 FROM pg_auth_members membership
              JOIN pg_roles subject ON subject.oid = membership.member
              WHERE subject.rolname = $1
            ) AS has_memberships
       FROM pg_roles r WHERE r.rolname = $1`,
    [RUNTIME],
  );
  const role = rows[0];
  if (
    !role ||
    !role.rolcanlogin ||
    role.rolsuper ||
    role.rolcreatedb ||
    role.rolcreaterole ||
    role.rolreplication ||
    role.rolbypassrls ||
    role.database_create ||
    role.owns_application_tables ||
    role.has_memberships
  )
    throw new Error('Runtime role privilege or ownership verification failed.');
}

async function verifyRuntime(adminPool, runtimePool) {
  await verifyRoleFlags(adminPool);
  const client = await runtimePool.connect();
  try {
    await client.query('BEGIN');
    const identity = (await client.query('SELECT current_user')).rows[0]
      ?.current_user;
    if (identity !== RUNTIME)
      throw new Error('Runtime smoke test connected as the wrong role.');
    const issuer = `urn:amr:azure-migration-smoke:${randomUUID()}`;
    const subject = randomUUID();
    const principal = (
      await client.query(
        `INSERT INTO app.principals (issuer, subject) VALUES ($1, $2)
         ON CONFLICT (issuer, subject) DO UPDATE SET subject = EXCLUDED.subject
         RETURNING id`,
        [issuer, subject],
      )
    ).rows[0];
    const profile = (
      await client.query(
        `INSERT INTO app.profiles (principal_id, kind) VALUES ($1, 'real') RETURNING id`,
        [principal.id],
      )
    ).rows[0];
    const tokenHash = DIGEST(randomUUID());
    await client.query(
      `INSERT INTO app.sessions (token_hash, principal_id, expires_at)
       VALUES ($1, $2, now() + interval '5 minutes')`,
      [tokenHash, principal.id],
    );
    const readable = await client.query(
      `SELECT p.id, f.id AS profile_id, s.token_hash
         FROM app.principals p
         JOIN app.profiles f ON f.principal_id = p.id
         JOIN app.sessions s ON s.principal_id = p.id
        WHERE p.id = $1`,
      [principal.id],
    );
    if (readable.rowCount !== 1 || readable.rows[0].profile_id !== profile.id)
      throw new Error('Runtime account/profile/session smoke test failed.');

    await assertDenied(client, 'CREATE TABLE public.amr_privilege_probe(id integer)', 'public DDL');
    await assertDenied(client, 'CREATE TABLE app.amr_privilege_probe(id integer)', 'app DDL');
    await assertDenied(client, 'CREATE ROLE amr_privilege_probe', 'role creation');
    await assertDenied(client, `UPDATE app.principals SET role = 'admin' WHERE false`, 'principal role write');
    await assertDenied(client, 'UPDATE app.role_assignments SET role = role WHERE false', 'role assignment write');
    await assertDenied(client, `INSERT INTO public.schema_migrations(name, checksum) VALUES ('amr_privilege_probe.sql', 'probe')`, 'migration ledger write');
    await client.query('ROLLBACK');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Rollback can fail only after the connection has already been lost.
    }
    throw error;
  } finally {
    client.release(true);
  }
}

export async function runAzureMigration({ adminPool, runtimePool, runtimePassword }) {
  const identity = await inPhase('admin identity', async () => {
    const row = (
      await adminPool.query('SELECT current_user, current_database()')
    ).rows[0];
    if (row?.current_user !== ADMIN)
      throw new Error('Connected identity is not the Azure bootstrap administrator.');
    await adminPool.query(`
      REVOKE CREATE ON DATABASE ${pg.escapeIdentifier(row.current_database)} FROM PUBLIC;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    `);
    return row;
  });
  const firstPass = await inPhase('migration', () => migrate(adminPool));
  const secondPass = await inPhase('migration replay', () => migrate(adminPool));
  if (firstPass !== secondPass)
    throw new Error('Migration replay count changed.');

  await inPhase('runtime role and grants', async () => {
    const client = await adminPool.connect();
    try {
      await client.query('BEGIN');
      await ensureRuntimeRole(client, runtimePassword);
      await applyRuntimeGrants(client);
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Connection is discarded below.
      }
      throw error;
    } finally {
      client.release(true);
    }
  });
  await inPhase('runtime privilege smoke test', () =>
    verifyRuntime(adminPool, runtimePool),
  );
  return secondPass;
}

export async function main(env = process.env) {
  const { url, runtimePassword } = migrationConfig(env);
  const adminPool = poolFor(url, 'amr-azure-migration');
  const runtimeUrl = new URL(url.href);
  runtimeUrl.username = RUNTIME;
  runtimeUrl.password = runtimePassword;
  const runtimePool = poolFor(runtimeUrl, 'amr-api-runtime-smoke');
  try {
    const applied = await runAzureMigration({
      adminPool,
      runtimePool,
      runtimePassword,
    });
    process.stdout.write(JSON.stringify({ status: 'migrated', migrations: applied }) + '\n');
  } finally {
    await Promise.all([adminPool.end(), runtimePool.end()]);
  }
}

if (
  process.argv[1] &&
  existsSync(resolve(process.argv[1])) &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'unknown failure';
    process.stderr.write(`Azure database migration failed: ${message}.\n`);
    process.exitCode = 1;
  });
}
