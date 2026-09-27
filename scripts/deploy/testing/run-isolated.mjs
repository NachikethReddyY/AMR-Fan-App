import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const name = `amr-migration-test-${randomBytes(6).toString('hex')}`;
const password = randomBytes(32).toString('hex');
const env = {
  ...process.env,
  POSTGRES_PASSWORD: password,
};
function docker(args, quiet = false) {
  const result = spawnSync('docker', args, {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 600_000,
    stdio: quiet ? 'pipe' : ['ignore', 'inherit', 'inherit'],
  });
  if (result.error || result.status !== 0)
    throw new Error(`Docker ${args[0]} failed`);
  return result.stdout?.trim();
}
let network;
let container;
let built = false;
try {
  docker(['version'], true);
  docker(['build', '-t', name, '-f', 'scripts/deploy/testing/Dockerfile', '.']);
  built = true;
  network = docker(['network', 'create', '--internal', name], true);
  container = docker(
    [
      'run',
      '-d',
      '--name',
      name,
      '--network',
      network,
      '--memory',
      '512m',
      '--cpus',
      '1',
      '--tmpfs',
      '/var/lib/postgresql/data',
      '-e',
      'POSTGRES_PASSWORD',
      '-e',
      'POSTGRES_DB=postgres',
      name,
    ],
    true,
  );
  console.log(
    `Owned container ${container}; network ${network}; no published ports or host mounts.`,
  );
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const probe = spawnSync(
      'docker',
      ['exec', container, 'pg_isready', '-U', 'postgres', '-d', 'postgres'],
      { stdio: 'ignore' },
    );
    if (probe.status === 0) {
      ready = true;
      break;
    }
    await setTimeout(1000);
  }
  if (!ready) throw new Error('Owned PostgreSQL did not become ready');
  docker([
    'exec',
    container,
    'node',
    '--input-type=module',
    '-e',
    "import {mkdirSync,writeFileSync} from 'node:fs'; mkdirSync('/run/amr-test',{mode:0o700}); writeFileSync('/run/amr-test/password',process.env.POSTGRES_PASSWORD,{mode:0o600});",
  ]);
  const isolation = JSON.parse(
    docker(['inspect', '--format', '{{json .}}', container], true),
  );
  if (
    Object.keys(isolation.HostConfig.PortBindings ?? {}).length ||
    isolation.Mounts.some((mount) => mount.Type === 'bind')
  )
    throw new Error(
      'Disposable fixture unexpectedly exposes host ports or mounts',
    );
  docker([
    'exec',
    '-e',
    'NODE_ENV=test',
    '-e',
    'AMR_OPS123_DISPOSABLE=true',
    container,
    'node',
    '--test',
    '--test-concurrency=1',
    'scripts/deploy/supabase-history.test.mjs',
    'scripts/deploy/supabase-database.test.mjs',
    'scripts/deploy/supabase-participation.test.mjs',
    'scripts/deploy/supabase-api.test.mjs',
    'scripts/deploy/supabase-schema-only.test.mjs',
  ]);
  docker([
    'exec',
    '-e',
    'NODE_ENV=test',
    '-e',
    'AMR_OPS123_DISPOSABLE=true',
    '-e',
    'AMR_OPS123_SCHEMA_ONLY=true',
    container,
    'node',
    '--test',
    'scripts/deploy/supabase-api.test.mjs',
  ]);
} finally {
  if (container) docker(['rm', '-f', container]);
  if (network) docker(['network', 'rm', network]);
  if (built) docker(['image', 'rm', name]);
  console.log('Owned test container, network and image cleaned.');
}
