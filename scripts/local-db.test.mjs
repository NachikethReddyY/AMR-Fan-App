import assert from 'node:assert/strict';
import test from 'node:test';
import { namespaceFor, requireLocalMode } from './local-db.mjs';

test('stable worktree namespaces differ and produce bounded PostgreSQL identifiers', () => {
  const first = namespaceFor('/tmp/worktree-a');
  assert.equal(first, namespaceFor('/tmp/worktree-a'));
  assert.notEqual(first, namespaceFor('/tmp/worktree-b'));
  assert.match(first, /^amr_[a-f0-9]{12}$/);
});
test('local operations reject production and ambiguous environment modes', () => {
  assert.throws(() => requireLocalMode({ NODE_ENV: 'production' }), /local/);
  assert.throws(() => requireLocalMode({ NODE_ENV: 'staging' }), /local/);
  assert.doesNotThrow(() => requireLocalMode({}));
  assert.doesNotThrow(() => requireLocalMode({ NODE_ENV: 'test' }));
});
