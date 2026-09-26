import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const name = `amr-ai-cost-${randomBytes(6).toString('hex')}`;
const password = randomBytes(32).toString('hex');
const env = {
  ...process.env,
  POSTGRES_PASSWORD: password,
  DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:5432/amr_ai_cost_test`,
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
  docker(['build', '-t', name, '-f', 'server/ai/testing/Dockerfile', '.']);
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
      'POSTGRES_DB=amr_ai_cost_test',
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
      [
        'exec',
        container,
        'pg_isready',
        '-U',
        'postgres',
        '-d',
        'amr_ai_cost_test',
      ],
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
    '-e',
    'DATABASE_URL',
    '-e',
    'NODE_ENV=test',
    '-e',
    'AMR_AI_COST_ISOLATED=true',
    container,
    'node',
    '--test',
    '--test-concurrency=1',
    'server/ai/testing/cost-store.database.test.ts',
  ]);
} finally {
  if (container) docker(['rm', '-f', container]);
  if (network) docker(['network', 'rm', network]);
  if (built) docker(['image', 'rm', name]);
  console.log('Owned test container, network and image cleaned.');
}
