import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApi } from '../../../api/app.ts';
import { createDatabase } from '../../../database/index.ts';
import { requireOwnTestDatabase } from '../test-server.ts';

requireOwnTestDatabase();
test('actual createApi serves participation admin assets', async () => {
  const pool = createDatabase();
  const server = createApi({
    pool,
    env: { NODE_ENV: 'test', AUTH_DEV_ENABLED: 'true', API_HOST: '127.0.0.1' },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  console.log(
    JSON.stringify({
      fixturePid: process.pid,
      fixturePort: address.port,
      host: '127.0.0.1',
    }),
  );
  try {
    const base = `http://127.0.0.1:${address.port}`;
    for (const [path, file] of [
      ['', 'index.html'],
      ['app.js', 'app.js'],
      ['style.css', 'style.css'],
    ]) {
      const response = await fetch(`${base}/admin/participation/${path}`);
      assert.equal(response.status, 200);
      assert.equal(
        await response.text(),
        await readFile(new URL(file, import.meta.url), 'utf8'),
      );
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal((await fetch(`${base}/admin/style.css`)).status, 200);
  } finally {
    server.close();
    await once(server, 'close');
    await pool.end();
    console.log(
      JSON.stringify({
        fixturePid: process.pid,
        fixturePort: address.port,
        closed: true,
      }),
    );
  }
});
