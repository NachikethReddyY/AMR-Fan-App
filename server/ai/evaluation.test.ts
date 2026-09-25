import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  writeFile,
  symlink,
  rm,
  access,
  chmod,
  mkdir,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const preload = new URL(
  './evaluation/testing/synthetic-provider.mjs',
  import.meta.url,
).href;
const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

async function workspace() {
  const cwd = await mkdtemp(join(tmpdir(), 'amr-ai-cli-'));
  await symlink(join(root, 'server'), join(cwd, 'server'));
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({
      private: true,
      scripts: { 'ai:evaluate': pkg.scripts['ai:evaluate'] },
    }),
  );
  const output = join(cwd, 'fresh.json');
  const calls = join(cwd, 'calls.jsonl');
  await writeFile(calls, '');
  return {
    cwd,
    output,
    async run(args: string[], failWrite = false) {
      const result = await new Promise<{ code: number | null; stderr: string }>(
        (resolve, reject) => {
          const child = spawn('pnpm', ['ai:evaluate', ...args], {
            cwd,
            env: {
              NODE_ENV: 'test',
              PATH: process.env.PATH,
              HOME: process.env.HOME,
              NODE_OPTIONS: `--import=${preload}`,
              LUNA_API_KEY: 'synthetic-only',
              LUNA_BASE_URL: 'http://127.0.0.1:1/v1',
              AMR_TEST_CALLS: calls,
              AMR_TEST_OUTPUT: output,
              AMR_TEST_WRITE_FAILURE: String(failWrite),
            },
            stdio: ['ignore', 'ignore', 'pipe'],
          });
          let stderr = '';
          child.stderr.on('data', (chunk) => {
            stderr += chunk;
          });
          child.on('error', reject);
          child.on('close', (code) => resolve({ code, stderr }));
        },
      );
      const recorded = (await readFile(calls, 'utf8')).trim();
      return {
        ...result,
        calls: recorded
          ? recorded.split('\n').map((line) => JSON.parse(line))
          : [],
      };
    },
    close: () => rm(cwd, { recursive: true, force: true }),
  };
}

test('documented pnpm command writes its destination and runs exactly 15 fresh reports', async () => {
  const w = await workspace();
  try {
    const docs = await readFile(join(root, 'docs/ai/runtime.md'), 'utf8');
    const command = docs.match(/`pnpm ai:evaluate ([^`]+)`/);
    assert.ok(command);
    const args = command[1]
      .split(' ')
      .map((arg) => (arg === '<new-evidence-path>' ? w.output : arg));
    const result = await w.run(args);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(
      await exists(w.output),
      true,
      'must write requested destination',
    );
    const evidence = JSON.parse(await readFile(w.output, 'utf8'));
    assert.equal(evidence.samples, 15);
    assert.equal(evidence.split, 'fresh');
    assert.equal((await stat(w.output)).mode & 0o777, 0o600);
    assert.equal(result.calls.length, 15);
    assert.ok(
      result.calls.every((call) => call.task === 'report' && call.reserved),
    );
    assert.equal(await exists(join(w.cwd, '--')), false);
  } finally {
    await w.close();
  }
});

for (const separator of [false, true]) {
  test(`explicit original split and optional separator ${separator} preserve the 16-case control`, async () => {
    const w = await workspace();
    try {
      const result = await w.run([
        ...(separator ? ['--'] : []),
        w.output,
        'original',
      ]);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.calls.length, 16);
      assert.equal(
        result.calls.filter((call) => call.task === 'route').length,
        4,
      );
      assert.equal(
        JSON.parse(await readFile(w.output, 'utf8')).split,
        'original',
      );
      assert.equal(await exists(join(w.cwd, '--')), false);
    } finally {
      await w.close();
    }
  });
}

test('legacy separator selects the fresh split at the intended destination', async () => {
  const w = await workspace();
  try {
    const result = await w.run(['--', w.output, 'fresh']);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.calls.length, 15);
    assert.ok(result.calls.every((call) => call.task === 'report'));
    assert.equal(JSON.parse(await readFile(w.output, 'utf8')).samples, 15);
    assert.equal(await exists(join(w.cwd, '--')), false);
  } finally {
    await w.close();
  }
});

for (const invalid of [
  'existing',
  'missing-parent',
  'parent-is-file',
  'unknown-split',
  'extra-argument',
]) {
  test(`evaluation rejects ${invalid} before any inference and preserves existing evidence`, async () => {
    const w = await workspace();
    try {
      const protectedPath = join(w.cwd, 'protected.json');
      await writeFile(protectedPath, 'existing evidence');
      const destination =
        invalid === 'existing'
          ? protectedPath
          : invalid === 'missing-parent'
            ? join(w.cwd, 'absent', 'result.json')
            : invalid === 'parent-is-file'
              ? join(protectedPath, 'result.json')
              : w.output;
      const args = [
        destination,
        invalid === 'unknown-split' ? 'freh' : 'fresh',
      ];
      if (invalid === 'extra-argument') args.push('extra');
      const result = await w.run(args);
      assert.notEqual(result.code, 0);
      assert.equal(result.calls.length, 0);
      assert.equal(await readFile(protectedPath, 'utf8'), 'existing evidence');
      assert.equal(await exists(w.output), false);
    } finally {
      await w.close();
    }
  });
}

test(
  'unwritable output directory causes zero calls',
  { skip: process.getuid?.() === 0 },
  async () => {
    const w = await workspace();
    const directory = join(w.cwd, 'readonly');
    try {
      await mkdir(directory, { mode: 0o500 });
      const output = join(directory, 'result.json');
      const result = await w.run([output, 'fresh']);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /EACCES/);
      assert.equal(result.calls.length, 0);
      assert.equal(await exists(output), false);
    } finally {
      await chmod(directory, 0o700);
      await w.close();
    }
  },
);

test('failed result write removes only the new reservation and closes it for a later retry', async () => {
  const w = await workspace();
  try {
    const failed = await w.run([w.output, 'fresh'], true);
    assert.notEqual(failed.code, 0);
    assert.match(failed.stderr, /synthetic disk write failure/);
    assert.equal(failed.calls.length, 15);
    assert.equal(await exists(w.output), false);
    const retried = await w.run([w.output, 'fresh']);
    assert.equal(retried.code, 0, retried.stderr);
    assert.equal(JSON.parse(await readFile(w.output, 'utf8')).samples, 15);
  } finally {
    await w.close();
  }
});
