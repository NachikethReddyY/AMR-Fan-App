/** Disposable fixture entry point only. No production or host credentials. */
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, chown, writeFile } from 'node:fs/promises';

if (
  process.platform !== 'linux' ||
  process.getuid?.() !== 0 ||
  process.env.AMR_REPORT_FIXTURE !== 'true'
)
  throw new Error('Use the owned disposable report runner.');
const namespace = `amr_${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const root = `/tmp/${namespace}/test`;
execFileSync('pg_ctlcluster', ['15', 'main', 'start'], { stdio: 'ignore' });
execFileSync(
  'runuser',
  ['-u', 'postgres', '--', 'psql', '-v', 'ON_ERROR_STOP=1'],
  {
    input: `CREATE ROLE ${namespace} LOGIN PASSWORD '${password}';\nCREATE DATABASE ${namespace}_test OWNER ${namespace};\n`,
    stdio: ['pipe', 'ignore', 'ignore'],
  },
);
await mkdir(root, { recursive: true, mode: 0o700 });
await chown(`/tmp/${namespace}`, 1000, 1000);
await chown(root, 1000, 1000);
await writeFile('/tmp/amr-parser-private-canary', 'synthetic private canary', {
  mode: 0o644,
});
const env = {
  PATH: '/usr/local/bin:/usr/bin:/bin',
  NODE_ENV: 'test',
  LANG: 'C.UTF-8',
  DATABASE_URL: `postgresql://${namespace}:${password}@127.0.0.1:5432/${namespace}_test`,
  REPORT_TEST_STORAGE: root,
  REPORT_TEST_SANDBOX: 'landlock',
} satisfies NodeJS.ProcessEnv;
const child = spawn(
  'node',
  [
    '--test',
    '--test-concurrency=1',
    'services/api/reports/hosted/linux.test.ts',
    'services/api/reports/reports.test.ts',
    'services/api/reports/storage.test.ts',
  ],
  { env, uid: 1000, gid: 1000, stdio: 'inherit' },
);
const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
child.on('exit', (code) => {
  clearTimeout(timer);
  process.exitCode = code ?? 1;
});
