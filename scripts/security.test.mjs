import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { validateDastConfig, evaluateZapReport } from './security.mjs';

test('an absent application target is not a scan pass', () => {
  assert.deepEqual(
    validateDastConfig({
      status: 'not-implemented',
      reason: 'No HTTP app',
      target: null,
    }),
    { applicable: false, reason: 'No HTTP app' },
  );
});

test('the CLI returns a distinct non-success status when no app exists', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'amr-dast-cli-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'security'));
  copyFileSync('scripts/security.mjs', join(root, 'scripts/security.mjs'));
  copyFileSync('security/tools.json', join(root, 'security/tools.json'));
  writeFileSync(
    join(root, 'security/dast-target.json'),
    JSON.stringify({
      status: 'not-implemented',
      reason: 'Synthetic no-server case',
      target: null,
    }),
  );
  const result = spawnSync(
    process.execPath,
    [join(root, 'scripts/security.mjs'), 'dast'],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 2);
  assert.match(result.stdout, /NOT APPLICABLE/);
});

test('an implemented target requires a contained Dockerfile and bounded port', () => {
  const config = {
    status: 'implemented',
    target: { dockerfile: 'web/Dockerfile', port: 3000 },
  };
  assert.equal(validateDastConfig(config).applicable, true);
  for (const dockerfile of [
    '../Dockerfile',
    '/tmp/Dockerfile',
    'https://example.com/Dockerfile',
  ]) {
    assert.throws(() =>
      validateDastConfig({ ...config, target: { dockerfile, port: 3000 } }),
    );
  }
  for (const port of [0, 65536, 3.5, '3000']) {
    assert.throws(() =>
      validateDastConfig({
        ...config,
        target: { dockerfile: 'web/Dockerfile', port },
      }),
    );
  }
});

test('malformed or contradictory DAST configuration fails closed', () => {
  for (const config of [
    null,
    {},
    { status: 'typo' },
    {
      status: 'not-implemented',
      reason: 'No HTTP app',
      target: { port: 3000 },
    },
    { status: 'implemented', target: null },
  ]) {
    assert.throws(() => validateDastConfig(config));
  }
});

const pathnameConfig = {
  status: 'implemented',
  target: { dockerfile: 'services/api/api/Dockerfile', port: 3000 },
};

test('DAST pathname defaults to root', () => {
  assert.equal(validateDastConfig(pathnameConfig).path, '/');
});

test('DAST accepts a bounded plain pathname', () => {
  const config = pathnameConfig;
  for (const path of ['/', '/admin/rewards/', '/health', '/assets/app.js'])
    assert.equal(
      validateDastConfig({ ...config, target: { ...config.target, path } })
        .path,
      path,
    );
});

test('DAST refuses authority, traversal and query or fragment ambiguity', () => {
  const config = pathnameConfig;
  for (const path of [
    '',
    null,
    123,
    'admin/rewards',
    '//other.test/',
    'https://other.test/',
    '/a/../admin',
    '/a/./admin',
    '/%2e%2e/admin',
    '/%252e%252e/admin',
    '/a\\b',
    '/admin?next=//other.test',
    '/admin#fragment',
    '/admin//rewards',
    '/admin\n',
    '/admin ',
    '/x@y',
    '/.',
    '/..',
    '/' + 'a'.repeat(2048),
  ])
    assert.throws(() =>
      validateDastConfig({ ...config, target: { ...config.target, path } }),
    );
});

test('untrusted config fields cannot override the applicability result', () => {
  const result = validateDastConfig({
    status: 'implemented',
    target: {
      dockerfile: 'web/Dockerfile',
      port: 3000,
      applicable: false,
    },
  });
  assert.equal(result.applicable, true);
});

const report = (alerts = []) => ({
  site: [{ '@name': 'http://target:3000', alerts }],
});

test('empty/missing reports and scanner failures never pass', () => {
  for (const value of [null, {}, { site: [] }, { site: [{}] }]) {
    assert.throws(() => evaluateZapReport(0, value));
  }
  assert.equal(evaluateZapReport(3, report()).passed, false);
  assert.equal(evaluateZapReport(null, report()).passed, false);
});

test('a scanned clean site passes; medium/high or explicit FAIL alerts block', () => {
  assert.equal(evaluateZapReport(0, report()).passed, true);
  assert.equal(
    evaluateZapReport(0, report([{ riskcode: '1', pluginid: '10015' }])).passed,
    true,
  );
  assert.equal(
    evaluateZapReport(0, report([{ riskcode: '2', pluginid: '10038' }])).passed,
    false,
  );
  assert.equal(
    evaluateZapReport(0, report([{ riskcode: '3', pluginid: '90000' }])).passed,
    false,
  );
  assert.equal(
    evaluateZapReport(1, report([{ riskcode: '1', pluginid: '10021' }])).passed,
    false,
  );
});
