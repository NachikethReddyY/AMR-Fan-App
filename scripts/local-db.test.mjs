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
import { namespaceFor, requireLocalMode } from './local-db.mjs';

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
