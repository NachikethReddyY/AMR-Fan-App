import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildAdmin } from './build-admin.mjs';

test('deploy artifact contains only public admin assets and fixed API routes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'amr-admin-build-'));
  try {
    await buildAdmin(dir);
    const files = (await readdir(dir, { recursive: true })).filter((p) =>
      /\./.test(p),
    );
    assert.equal(files.length, 15);
    assert.ok(files.every((p) => /\.(html|js|css|json)$/.test(p)));
    assert.ok(
      files.every((p) => !/test|\.env|evidence|package|services\/api/.test(p)),
    );
    for (const section of [
      '',
      'rewards/',
      'submissions/',
      'reports/',
      'participation/',
    ]) {
      const html = await readFile(
        join(dir, 'admin', section, 'index.html'),
        'utf8',
      );
      assert.match(html, /aria-label="Administration"/);
      assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
      assert.match(html, /id="password-signin" method="get"/);
      assert.doesNotMatch(html, /name="(?:email|password)"/);
    }
    const config = JSON.parse(await readFile(join(dir, 'vercel.json'), 'utf8'));
    assert.equal(config.framework, null);
    assert.ok(
      config.rewrites.every((route) =>
        route.destination.startsWith('https://amr-fan-app.onrender.com/'),
      ),
    );
    assert.equal(
      config.rewrites.some((route) => /dev|:path\*/.test(route.source)),
      false,
    );
    assert.equal(
      config.rewrites.some((route) =>
        /origin/i.test(JSON.stringify(route.headers)),
      ),
      false,
    );
    assert.ok(
      config.headers[0].headers.some(
        (h) => h.key === 'Cache-Control' && h.value === 'no-store',
      ),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('repository Vercel config routes the deployed dashboard to the API', async () => {
  const config = JSON.parse(
    await readFile(
      fileURLToPath(new URL('../vercel.json', import.meta.url)),
      'utf8',
    ),
  );
  assert.equal(config.outputDirectory, 'dist/admin-vercel');
  assert.equal(config.redirects[0].destination, '/admin/');
  assert.ok(config.rewrites.some((route) => route.source === '/admin/config'));
  assert.ok(config.rewrites.some((route) => route.source === '/v1/session'));
});

test('build refuses output containing a secret or stale file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'amr-admin-stale-'));
  try {
    await writeFile(join(dir, '.env.local'), 'SYNTHETIC_ONLY=fixture');
    await assert.rejects(buildAdmin(dir), /must be empty/);
    assert.deepEqual(await readdir(dir), ['.env.local']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
