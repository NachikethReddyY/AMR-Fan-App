import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  namespaceFor,
  repositoryRoot,
  requireLocalMode,
  testDatabaseName,
} from './local-db.mjs';

test('stable real worktree namespaces differ and resolve directory aliases', (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'amr-namespace-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const first = join(parent, 'worktree-a');
  const second = join(parent, 'worktree-b');
  const alias = join(parent, 'alias');
  mkdirSync(first);
  mkdirSync(second);
  symlinkSync(first, alias, 'dir');
  assert.equal(namespaceFor(first), namespaceFor(first));
  assert.notEqual(namespaceFor(first), namespaceFor(second));
  assert.match(namespaceFor(first), /^amr_[a-f0-9]{12}$/);
  assert.equal(namespaceFor(first), namespaceFor(alias));
});

test('test database name uses the repository root, matching the runner', () => {
  assert.equal(testDatabaseName(), `${namespaceFor(repositoryRoot)}_test`);
  assert.notEqual(
    testDatabaseName(),
    `${namespaceFor(join(repositoryRoot, 'services'))}_test`,
  );
});

test('same-inode casing aliases select the same namespace on case-insensitive volumes', (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'amr-casing-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const actual = join(parent, 'Worktree');
  const alias = join(parent, 'WORKTREE');
  mkdirSync(actual);
  if (!existsSync(alias)) return t.skip('Filesystem is case-sensitive.');
  assert.equal(statSync(actual).ino, statSync(alias).ino);
  assert.equal(namespaceFor(actual), namespaceFor(alias));
});

test('local helpers can be imported from node stdin without treating dash as a file', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-'], {
    input: "await import('./scripts/local-db.mjs');\n",
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('local operations reject production and ambiguous environment modes', () => {
  assert.throws(() => requireLocalMode({ NODE_ENV: 'production' }), /local/);
  assert.throws(() => requireLocalMode({ NODE_ENV: 'staging' }), /local/);
  assert.doesNotThrow(() => requireLocalMode({}));
  assert.doesNotThrow(() => requireLocalMode({ NODE_ENV: 'test' }));
});

test('CI database overrides require opt-in and reject paths outside the run', () => {
  const run = (env) =>
    spawnSync(process.execPath, ['--input-type=module', '-'], {
      input: "await import('./scripts/local-db.mjs');\n",
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
  const valid = {
    AMR_DB_CI_MODE: 'true',
    AMR_LOCAL_DB_AUTH_DIR:
      '/home/runner/.local/share/black-box-runner/state/transient/123-1/auth',
    AMR_LOCAL_DB_PROJECT: 'blackbox-amr-123-1',
    AMR_LOCAL_DB_COMPOSE_FILE:
      '/home/runner/work/amr/.github/blackbox/amr-ci-compose.override.yaml',
  };
  assert.equal(run(valid).status, 0);
  for (const env of [
    { ...valid, AMR_DB_CI_MODE: 'false' },
    { ...valid, AMR_LOCAL_DB_AUTH_DIR: '/tmp/auth' },
    { ...valid, AMR_LOCAL_DB_PROJECT: 'amr-local-postgres' },
    { ...valid, AMR_LOCAL_DB_COMPOSE_FILE: '/tmp/compose.yaml' },
    {
      ...valid,
      AMR_LOCAL_DB_AUTH_DIR:
        '/home/runner/../black-box-runner/state/transient/123-1/auth',
    },
  ]) {
    const result = run(env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires a valid CI-owned value/);
  }
});
