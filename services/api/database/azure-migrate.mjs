import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrate } from './migrate.ts';

const ADMIN = 'amr_staging_admin';
const RUNTIME = 'amr_api';
const ownerUrl = process.env.AZURE_MIGRATION_DATABASE_URL;
const runtimePassword = process.env.AZURE_RUNTIME_DATABASE_PASSWORD;

function fail(message) {
  throw new Error(message);
}

if (!ownerUrl || !runtimePassword)
  fail('Migration credentials must be supplied through the process environment.');
if (!/^[A-Za-z0-9_-]{48,128}$/.test(runtimePassword))
  fail('Runtime password must be a random 48-128 character value.');
let parsed;
try {
  parsed = new URL(ownerUrl);
} catch {
  fail('Migration URL must be a PostgreSQL URL.');
}
if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
  fail('Migration URL must be a PostgreSQL URL.');
if (parsed.username !== ADMIN)
  fail(`Migration URL must use ${ADMIN}; the runtime role is not accepted.`);
if (parsed.search || parsed.hash)
  fail('Migration URL must not contain query or fragment parameters.');
if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname))
  fail('Azure migration refuses a local database URL.');

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

async function roleState(client) {
  return (
    await client.query(
      `SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
              rolreplication, rolbypassrls, rolinherit
         FROM pg_roles WHERE rolname = $1`,
      [RUNTIME],
    )
  ).rows[0];
}

async function ensureRuntimeRole(client) {
  const state = await roleState(client);
  if (!state) {
    await client.query(
      `CREATE ROLE ${RUNTIME} LOGIN NOINHERIT PASSWORD ${pg.escapeLiteral(runtimePassword)}
       NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
    return;
  }
  if (
    !state.rolcanlogin ||
    state.rolsuper ||
    state.rolcreatedb ||
    state.rolcreaterole ||
    state.rolreplication ||
    state.rolbypassrls ||
    state.rolinherit
  )
    fail('Existing amr_api role has unsafe privileges.');
  await client.query(
    `ALTER ROLE ${RUNTIME} LOGIN NOINHERIT PASSWORD ${pg.escapeLiteral(runtimePassword)}`,
  );
  const memberships = await client.query(
    `SELECT 1
       FROM pg_auth_members member
       JOIN pg_roles granted ON granted.oid = member.roleid
       JOIN pg_roles subject ON subject.oid = member.member
      WHERE subject.rolname = $1`,
    [RUNTIME],
  );
  if (memberships.rowCount) fail('Existing amr_api role has role memberships.');
}

async function grantRuntimeSurface(client) {
  const database = (await client.query('SELECT current_database() AS name')).rows[0]
    .name;
  await client.query(`
    REVOKE CREATE ON DATABASE ${pg.escapeIdentifier(database)} FROM PUBLIC;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    REVOKE ALL ON SCHEMA app FROM PUBLIC, ${RUNTIME};
    GRANT USAGE ON SCHEMA app TO ${RUNTIME};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO ${RUNTIME};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO ${RUNTIME};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO ${RUNTIME};
    REVOKE ALL ON public.schema_migrations FROM PUBLIC, ${RUNTIME};
    GRANT SELECT ON public.schema_migrations TO ${RUNTIME};
    REVOKE INSERT, UPDATE, DELETE ON app.principals, app.role_assignments FROM ${RUNTIME};
    GRANT INSERT (issuer, subject), UPDATE (subject) ON app.principals TO ${RUNTIME};
  `);
}

async function assertDenied(client, sql, label) {
  await client.query('SAVEPOINT azure_privilege_probe');
  try {
    await client.query(sql);
    fail(`Runtime privilege probe unexpectedly succeeded: ${label}`);
  } catch (error) {
    if (error?.code !== '42501') fail(`Runtime privilege probe failed: ${label}`);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT azure_privilege_probe');
    await client.query('RELEASE SAVEPOINT azure_privilege_probe');
  }
}

async function verifyRuntime(adminPool, runtimePool) {
  const state = await adminPool.query(
    `SELECT r.rolcanlogin, r.rolsuper, r.rolcreatedb, r.rolcreaterole,
            r.rolreplication, r.rolbypassrls, r.rolinherit,
            has_database_privilege($1, current_database(), 'CREATE') AS database_create,
            EXISTS (
              SELECT 1 FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE pg_get_userbyid(c.relowner) = $1
            ) AS owns_table
       FROM pg_roles r WHERE r.rolname = $1`,
    [RUNTIME],
  );
  const row = state.rows[0];
  if (
    !row ||
    !row.rolcanlogin ||
    row.rolsuper ||
    row.rolcreatedb ||
    row.rolcreaterole ||
    row.rolreplication ||
    row.rolbypassrls ||
    row.rolinherit ||
    row.database_create ||
    row.owns_table
  )
    fail('Runtime role privilege or ownership verification failed.');

  const client = await runtimePool.connect();
  try {
    await client.query('BEGIN');
    const identity = (await client.query('SELECT current_user')).rows[0].current_user;
    if (identity !== RUNTIME) fail('Runtime smoke test connected as the wrong role.');
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
    const tokenHash = createHash('sha256').update(randomUUID()).digest('hex');
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
      fail('Runtime account/profile/session smoke test failed.');
    await assertDenied(client, 'CREATE TABLE public.azure_migration_probe(id integer)', 'public DDL');
    await assertDenied(client, 'CREATE TABLE app.azure_migration_probe(id integer)', 'app DDL');
    await assertDenied(client, 'CREATE ROLE azure_migration_probe', 'role creation');
    await assertDenied(client, `UPDATE app.principals SET role = 'admin' WHERE false`, 'principal role write');
    await assertDenied(client, 'UPDATE app.role_assignments SET role = role WHERE false', 'role assignment write');
    await assertDenied(client, `INSERT INTO public.schema_migrations(name, checksum) VALUES ('azure_probe.sql', 'probe')`, 'migration ledger write');
    await client.query('ROLLBACK');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is discarded by release below.
    }
    throw error;
  } finally {
    client.release(true);
  }
}

const adminPool = poolFor(parsed, 'amr-azure-migration');
const runtimeUrl = new URL(parsed.href);
runtimeUrl.username = RUNTIME;
runtimeUrl.password = runtimePassword;
const runtimePool = poolFor(runtimeUrl, 'amr-api-runtime-smoke');
try {
  const identity = (await adminPool.query('SELECT current_user, current_database()')).rows[0];
  if (identity?.current_user !== ADMIN) fail('Connected identity is not the Azure migration administrator.');
  const applied = await migrate(adminPool);
  const replayed = await migrate(adminPool);
  if (applied !== replayed) fail('Migration replay count changed.');
  const client = await adminPool.connect();
  try {
    await client.query('BEGIN');
    await ensureRuntimeRole(client);
    await grantRuntimeSurface(client);
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is discarded by release below.
    }
    throw error;
  } finally {
    client.release(true);
  }
  await verifyRuntime(adminPool, runtimePool);
  process.stdout.write(JSON.stringify({ status: 'migrated', migrations: replayed }) + '\n');
} catch {
  // Never expose connection strings, SQL text, provider responses or passwords.
  process.stderr.write('Azure database migration failed; no credentials or SQL details were printed.\n');
  process.exitCode = 1;
} finally {
  await Promise.all([adminPool.end(), runtimePool.end()]);
}
