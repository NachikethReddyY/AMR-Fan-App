import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { Pool, escapeIdentifier, escapeLiteral } from 'pg';
import { createDatabase } from '../server/database/index.ts';
import { migrate } from '../server/database/migrate.ts';
import { seedLocal } from '../server/database/seed.ts';

const root = realpathSync.native(
  resolve(dirname(fileURLToPath(import.meta.url)), '..'),
);
const auth = join(homedir(), '.auth', 'amr-local-postgres');
const ownerFile = join(auth, 'owner.json');
const passwordFile = join(auth, 'postgres-password');
const project = 'amr-local-postgres';
class LocalSetupError extends Error {}

export function requireLocalMode(env = process.env) {
  if (env.NODE_ENV && !['development', 'test'].includes(env.NODE_ENV)) {
    throw new LocalSetupError(
      'This command supports local development/test only.',
    );
  }
}
export function namespaceFor(worktree) {
  return (
    'amr_' +
    createHash('sha256')
      .update(realpathSync.native(worktree))
      .digest('hex')
      .slice(0, 12)
  );
}
function privateWrite(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, value, { mode: 0o600, flag: 'wx' });
}
function privateRead(path) {
  if (!existsSync(path) || (statSync(path).mode & 0o077) !== 0) {
    throw new LocalSetupError(
      'Private local configuration is missing or must have mode 600. Ask the database owner to provision this worktree.',
    );
  }
  return readFileSync(path, 'utf8');
}
function ownerConfig() {
  const value = JSON.parse(privateRead(ownerFile));
  if (
    value.project !== project ||
    !Number.isInteger(value.port) ||
    value.port < 1024 ||
    value.port > 65535 ||
    typeof value.worktree !== 'string'
  ) {
    throw new LocalSetupError('Invalid local database owner configuration.');
  }
  return value;
}
function requireOwner(config) {
  if (config.worktree !== root)
    throw new LocalSetupError(
      'Only the recorded service owner can provision, restart or stop this database.',
    );
}
function worktreeConfig(worktree = root) {
  worktree = realpathSync.native(worktree);
  const namespace = namespaceFor(worktree);
  const value = JSON.parse(
    privateRead(join(auth, 'worktrees', namespace + '.json')),
  );
  if (
    value.namespace !== namespace ||
    value.worktree !== worktree ||
    typeof value.password !== 'string' ||
    !/^[a-f0-9]{48}$/.test(value.password) ||
    !Number.isInteger(value.port)
  ) {
    throw new LocalSetupError('Invalid worktree database configuration.');
  }
  return value;
}
export function localEnvironment(kind = 'dev', worktree = root) {
  requireLocalMode();
  if (!['dev', 'test'].includes(kind))
    throw new LocalSetupError('Unknown local database kind.');
  const config = worktreeConfig(worktree);
  const database = config.namespace + '_' + kind;
  return {
    NODE_ENV: kind === 'test' ? 'test' : 'development',
    DATABASE_URL: `postgresql://${config.namespace}:${config.password}@127.0.0.1:${config.port}/${database}`,
  };
}
function command(program, args, env = process.env) {
  const result = spawnSync(program, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    timeout: 600000,
  });
  if (result.error || result.status !== 0)
    throw new LocalSetupError(
      `${program} failed; check the preceding non-secret output.`,
    );
}
function docker(args, config) {
  command(
    'docker',
    [
      'compose',
      '--project-name',
      project,
      '--file',
      join(root, 'compose.yaml'),
      ...args,
    ],
    {
      ...process.env,
      AMR_DB_PORT: String(config.port),
      AMR_DB_PASSWORD_FILE: passwordFile,
    },
  );
}
async function assertPortFree(port) {
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', () =>
      reject(
        new LocalSetupError(
          'Leased database port is already occupied. Do not reclaim it.',
        ),
      ),
    );
    server.listen(port, '127.0.0.1', () => server.close(resolvePort));
  });
}
async function withAdmin(config, operation) {
  const pool = new Pool({
    host: '127.0.0.1',
    port: config.port,
    user: 'postgres',
    database: 'postgres',
    password: privateRead(passwordFile).trim(),
    connectionTimeoutMillis: 5000,
    max: 1,
  });
  try {
    return await operation(pool);
  } finally {
    await pool.end();
  }
}
async function provision(config, worktree) {
  requireOwner(config);
  const namespace = namespaceFor(worktree);
  const path = join(auth, 'worktrees', namespace + '.json');
  if (!existsSync(path))
    privateWrite(
      path,
      JSON.stringify({
        namespace,
        worktree,
        port: config.port,
        password: randomBytes(24).toString('hex'),
      }),
    );
  const credentials = worktreeConfig(worktree);
  await withAdmin(config, async (admin) => {
    // Provisioning is serialized by the service owner's operations lease.
    const role = await admin.query(
      'SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = $1',
      [namespace],
    );
    if (role.rowCount && Object.values(role.rows[0]).some(Boolean)) {
      throw new LocalSetupError(
        'Existing namespace role has unexpected privileges; refusing to reuse it.',
      );
    }
    if (!role.rowCount) {
      await admin.query(
        `CREATE ROLE ${escapeIdentifier(namespace)} LOGIN PASSWORD ${escapeLiteral(credentials.password)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
      );
    }
    for (const kind of ['dev', 'test']) {
      const name = namespace + '_' + kind;
      const exists = await admin.query(
        'SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1',
        [name],
      );
      if (exists.rowCount && exists.rows[0].owner !== namespace)
        throw new LocalSetupError(
          'Namespace already belongs to another role; refusing to change it.',
        );
      if (!exists.rowCount)
        await admin.query(
          `CREATE DATABASE ${escapeIdentifier(name)} OWNER ${escapeIdentifier(namespace)} ALLOW_CONNECTIONS false`,
        );
      await admin.query(
        `REVOKE ALL ON DATABASE ${escapeIdentifier(name)} FROM PUBLIC`,
      );
      await admin.query(
        `GRANT CONNECT, TEMPORARY ON DATABASE ${escapeIdentifier(name)} TO ${escapeIdentifier(namespace)}`,
      );
      await admin.query(
        `ALTER DATABASE ${escapeIdentifier(name)} ALLOW_CONNECTIONS true`,
      );
    }
  });
  console.log(
    `Provisioned ${namespace}_{dev,test}; credentials stored privately outside the repository.`,
  );
}
async function withLocal(kind, operation) {
  const env = localEnvironment(kind);
  const pool = createDatabase(env);
  try {
    return await operation(pool, env);
  } finally {
    await pool.end();
  }
}
async function verify() {
  const config = ownerConfig();
  requireOwner(config);
  await withLocal('dev', async (pool, env) => {
    await migrate(pool);
    await migrate(pool);
    await seedLocal(pool, env);
    await seedLocal(pool, env);
    await pool.query(
      "INSERT INTO local_fixture.probes VALUES ('persistence', 731, 'Synthetic restart sentinel') ON CONFLICT (name) DO UPDATE SET value = 731",
    );
  });
  await main(['reset-test']);
  await main(['test']);
  const peer = 'amr_' + randomBytes(6).toString('hex');
  const database = peer + '_test';
  const peerPassword = randomBytes(24).toString('hex');
  await withAdmin(config, async (admin) => {
    let roleCreated = false;
    let databaseCreated = false;
    try {
      await admin.query(
        `CREATE ROLE ${escapeIdentifier(peer)} LOGIN PASSWORD ${escapeLiteral(peerPassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
      );
      roleCreated = true;
      await admin.query(
        `CREATE DATABASE ${escapeIdentifier(database)} OWNER ${escapeIdentifier(peer)} ALLOW_CONNECTIONS false`,
      );
      databaseCreated = true;
      await admin.query(
        `REVOKE ALL ON DATABASE ${escapeIdentifier(database)} FROM PUBLIC`,
      );
      await admin.query(
        `GRANT CONNECT ON DATABASE ${escapeIdentifier(database)} TO ${escapeIdentifier(peer)}`,
      );
      await admin.query(
        `ALTER DATABASE ${escapeIdentifier(database)} ALLOW_CONNECTIONS true`,
      );
      const mine = localEnvironment('test');
      const myUrl = new URL(mine.DATABASE_URL);
      const otherUrl = new URL(myUrl);
      otherUrl.pathname = '/' + database;
      const forbidden = createDatabase({
        ...mine,
        DATABASE_URL: otherUrl.href,
      });
      try {
        await assertConnectionDenied(forbidden);
      } finally {
        await forbidden.end();
      }
      otherUrl.username = peer;
      otherUrl.password = peerPassword;
      const other = createDatabase({ ...mine, DATABASE_URL: otherUrl.href });
      try {
        await other.query(
          'CREATE TABLE sentinel(value integer); INSERT INTO sentinel VALUES (219)',
        );
        await main(['reset-test']);
        if (
          (await other.query('SELECT value FROM sentinel')).rows[0].value !==
          219
        )
          throw new LocalSetupError('Peer data changed during own test reset.');
      } finally {
        await other.end();
      }
      otherUrl.pathname = myUrl.pathname;
      const reverse = createDatabase({ ...mine, DATABASE_URL: otherUrl.href });
      try {
        await assertConnectionDenied(reverse);
      } finally {
        await reverse.end();
      }
      console.log(
        'PASS: separate namespace roles deny cross-database connections in both directions; own reset preserves peer data.',
      );
    } finally {
      if (databaseCreated)
        await admin.query(`DROP DATABASE ${escapeIdentifier(database)}`);
      if (roleCreated) await admin.query(`DROP ROLE ${escapeIdentifier(peer)}`);
    }
  });
  // Run only under the shared service owner's restart lease, before consumers attach.
  await main(['restart']);
  await withLocal('dev', async (pool) => {
    const sentinel = await pool.query(
      "SELECT value FROM local_fixture.probes WHERE name = 'persistence'",
    );
    if (sentinel.rows[0]?.value !== 731)
      throw new LocalSetupError(
        'Restart or test reset lost the development sentinel.',
      );
    await pool.query(
      "DELETE FROM local_fixture.probes WHERE name = 'persistence'",
    );
  });
  const result = spawnSync(
    'docker',
    [
      'compose',
      '--project-name',
      project,
      '--file',
      join(root, 'compose.yaml'),
      'ps',
      '--format',
      'json',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        AMR_DB_PORT: String(config.port),
        AMR_DB_PASSWORD_FILE: passwordFile,
      },
    },
  );
  if (result.status !== 0)
    throw new LocalSetupError('Cannot inspect exact port binding.');
  const services = result.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const bindings = services.flatMap((service) => service.Publishers ?? []);
  if (
    services.length !== 1 ||
    bindings.length !== 1 ||
    bindings[0].URL !== '127.0.0.1' ||
    bindings[0].PublishedPort !== config.port ||
    bindings[0].TargetPort !== 5432
  )
    throw new LocalSetupError(
      'Expected exactly one published localhost database port.',
    );
  for (const path of [
    ownerFile,
    passwordFile,
    join(auth, 'worktrees', namespaceFor(root) + '.json'),
  ])
    privateRead(path);
  console.log(
    'PASS: ready PostgreSQL, repeatable migration/seed, transactional rollback/concurrency, preserved restart data, one 127.0.0.1 port and private configuration.',
  );
}
async function assertConnectionDenied(pool) {
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    if (error.code === '42501') return;
    throw error;
  }
  throw new LocalSetupError(
    'Cross-namespace connection unexpectedly succeeded.',
  );
}
async function main([action, ...args]) {
  requireLocalMode();
  if (action === 'verify') {
    if (args.length) throw new LocalSetupError('verify accepts no overrides.');
    await verify();
  } else if (action === 'up') {
    if (!existsSync(ownerFile)) {
      if (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1]))
        throw new LocalSetupError(
          'First start requires --port <operations-leased-port>.',
        );
      const port = Number(args[1]);
      if (!Number.isInteger(port) || port < 1024 || port > 65535)
        throw new LocalSetupError(
          'Choose an unprivileged leased port, 1024–65535.',
        );
      await assertPortFree(port);
      privateWrite(passwordFile, randomBytes(32).toString('hex') + '\n');
      privateWrite(
        ownerFile,
        JSON.stringify({ project, port, worktree: root }),
      );
    }
    const config = ownerConfig();
    requireOwner(config);
    if (
      args.length &&
      (args.length !== 2 ||
        args[0] !== '--port' ||
        Number(args[1]) !== config.port)
    )
      throw new LocalSetupError(
        'Requested port differs from the persisted service lease.',
      );
    docker(['up', '-d', '--wait', '--wait-timeout', '90'], config);
    await provision(config, root);
  } else if (action === 'provision') {
    if (args.length !== 0 && (args.length !== 2 || args[0] !== '--worktree'))
      throw new LocalSetupError(
        'Usage: provision [--worktree <existing-path>]',
      );
    const worktree = args.length ? realpathSync.native(args[1]) : root;
    if (!existsSync(join(worktree, '.git')))
      throw new LocalSetupError('Provision only an existing Git worktree.');
    await provision(ownerConfig(), worktree);
  } else if (['stop', 'restart'].includes(action)) {
    const config = ownerConfig();
    requireOwner(config);
    if (args.length)
      throw new LocalSetupError(
        'Lifecycle commands accept no resource overrides.',
      );
    docker([action, 'postgres'], config);
    if (action === 'restart')
      docker(['up', '-d', '--wait', '--wait-timeout', '90'], config);
  } else if (['migrate', 'seed', 'status', 'reset-test'].includes(action)) {
    if (
      args.length &&
      !(
        args.length === 1 &&
        args[0] === '--test' &&
        ['migrate', 'seed', 'status'].includes(action)
      )
    )
      throw new LocalSetupError(
        'Use --test only to select this worktree test database.',
      );
    const kind =
      action === 'reset-test' || args[0] === '--test' ? 'test' : 'dev';
    await withLocal(kind, async (pool, env) => {
      if (action === 'reset-test') {
        const name = namespaceFor(root) + '_test';
        const actual = await pool.query('SELECT current_database() AS name');
        if (actual.rows[0].name !== name)
          throw new LocalSetupError('Refusing to reset a different database.');
        await pool.query(
          'BEGIN; DROP SCHEMA IF EXISTS app CASCADE; DROP SCHEMA IF EXISTS local_fixture CASCADE; DROP TABLE IF EXISTS public.schema_migrations; COMMIT;',
        );
      }
      if (action === 'migrate' || action === 'reset-test') await migrate(pool);
      if (action === 'seed' || action === 'reset-test')
        await seedLocal(pool, env);
      if (action === 'status') {
        const result = await pool.query(
          'SELECT current_database() AS database, current_user AS role, version()',
        );
        console.log(JSON.stringify(result.rows[0]));
      } else console.log(`${action}: ${namespaceFor(root)}_${kind} complete`);
    });
  } else if (action === 'test' || action === 'run' || action === 'run-test') {
    const env = {
      ...process.env,
      ...localEnvironment(action === 'run' ? 'dev' : 'test'),
    };
    if (action === 'test')
      command(
        process.execPath,
        ['--test', 'server/database/integration.test.ts'],
        env,
      );
    else {
      if (args[0] === '--') args.shift();
      if (!args.length)
        throw new LocalSetupError(
          'run requires a server-side command. Never print its environment.',
        );
      command(args[0], args.slice(1), env);
    }
  } else
    throw new LocalSetupError(
      'Usage: local-db.mjs up|provision|migrate|seed|status|reset-test|test|run|run-test|verify|restart|stop',
    );
}
if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync.native(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof LocalSetupError
        ? error.message
        : 'Local database operation failed. Check service readiness and private configuration; credentials are not logged.',
    );
    process.exitCode = 1;
  });
}
