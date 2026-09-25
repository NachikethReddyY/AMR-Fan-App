import assert from 'node:assert/strict';
import childProcess, {
  type ChildProcess,
  type SpawnOptions,
} from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test, mock } from 'node:test';
import { createParser } from './parser.ts';
import { syntheticPdf } from './testing/fixtures.ts';

const originalSpawn = childProcess.spawn;
const fixture = fileURLToPath(
  new URL('./testing/parser-child.mjs', import.meta.url),
);
const pdf = syntheticPdf([['Synthetic parser boundary recovery']]);

// Substitute only the external child program; the real sandbox, pipes, watchdog,
// timeout, termination and parent result validation remain under test.
async function controlled(mode: string, expected: RegExp, timeoutMs = 3000) {
  let child: ChildProcess | undefined;
  let maximumRssKiB = 0;
  let observedOutputBytes = 0;
  const signals: { code: number | null; signal: NodeJS.Signals | null }[] = [];
  const replacement = (
    command: string,
    args: readonly string[] = [],
    options: SpawnOptions = {},
  ) => {
    if (command === '/usr/bin/sandbox-exec' && Array.isArray(args)) {
      const worker = args.findIndex((arg) => arg.endsWith('/parser-worker.ts'));
      assert.ok(worker >= 0);
      child = originalSpawn(
        command,
        [
          ...args.slice(0, worker),
          fixture,
          mode === 'measurement-failure' ? 'wait' : mode,
        ],
        options,
      );
      child.on('close', (code, signal) => signals.push({ code, signal }));
      child.stdout?.on('data', (chunk: Buffer) => {
        observedOutputBytes += chunk.length;
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        observedOutputBytes += chunk.length;
      });
      return child;
    }
    if (command === '/bin/ps' && mode === 'measurement-failure')
      return originalSpawn(
        process.execPath,
        ['-e', 'process.exit(2)'],
        options,
      );
    const probe = originalSpawn(command, args, options);
    if (command === '/bin/ps') {
      let reading = '';
      probe.stdout?.on('data', (chunk: Buffer) => {
        reading += chunk.toString();
      });
      probe.on('close', () => {
        maximumRssKiB = Math.max(maximumRssKiB, Number(reading.trim()) || 0);
      });
    }
    return probe;
  };
  const hook = mock.method(childProcess, 'spawn', replacement);
  syncBuiltinESMExports();
  try {
    await assert.rejects(createParser({ timeoutMs }).parse(pdf), expected);
    assert.ok(child?.pid);
    assert.equal(
      signals.length,
      1,
      'Failure resolves only after the child is reaped.',
    );
    const pid = child.pid;
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    assert.deepEqual(
      signals[0],
      mode === 'crash'
        ? { code: 7, signal: null }
        : { code: null, signal: 'SIGKILL' },
    );
    if (mode === 'memory') assert.ok(maximumRssKiB > 768 * 1024);
    if (mode === 'output') assert.ok(observedOutputBytes > 8 * 1024 * 1024);
    process.stdout.write(
      JSON.stringify({
        mode,
        maximumRssKiB,
        observedOutputBytes,
        ...signals[0],
      }) + '\n',
    );
  } finally {
    hook.mock.restore();
    syncBuiltinESMExports();
    if (child && child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL');
  }
  const recovered = await createParser().parse(pdf);
  assert.equal(recovered.pages[0]?.text, 'Synthetic parser boundary recovery');
}

test('combined output overflow kills the real child and permits recovery', () =>
  controlled('output', /output limit exceeded/));
test('sampled RSS overflow kills the real child and permits recovery', () =>
  controlled('memory', /memory limit exceeded/));
test('timeout kills the real waiting child and permits recovery', () =>
  controlled('wait', /timed out/, 150));
test('abrupt child failure is reaped and permits recovery', () =>
  controlled('crash', /invalid data/));
test('unavailable RSS measurement kills the child instead of disabling its guard', () =>
  controlled('measurement-failure', /memory measurement unavailable/, 500));

test('unsupported host fails closed before any child is started', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  assert.ok(descriptor);
  let spawned = false;
  const hook = mock.method(childProcess, 'spawn', () => {
    spawned = true;
    throw new Error('Unexpected child');
  });
  syncBuiltinESMExports();
  Object.defineProperty(process, 'platform', { value: 'unsupported' });
  try {
    await assert.rejects(
      createParser().parse(pdf),
      (error: unknown) =>
        error instanceof Error && 'status' in error && error.status === 503,
    );
    assert.equal(spawned, false);
  } finally {
    Object.defineProperty(process, 'platform', descriptor);
    hook.mock.restore();
    syncBuiltinESMExports();
  }
});
