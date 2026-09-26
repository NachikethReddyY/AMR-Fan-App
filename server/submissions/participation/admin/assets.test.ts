import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { serveParticipationAdmin } from '../../participation-admin.ts';

test('participation assets have an exact public allowlist, same-origin CSP and no private/test sources', async () => {
  const server = createServer(async (req, res) => {
    if (!(await serveParticipationAdmin(req.url ?? '/', res))) {
      res.writeHead(404);
      res.end();
    }
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
    for (const [path, type] of [
      ['', 'text/html'],
      ['app.js', 'text/javascript'],
      ['style.css', 'text/css'],
    ]) {
      const response = await fetch(`${base}/admin/participation/${path}`);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type')?.startsWith(type));
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(
        response.headers.get('content-security-policy'),
        "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      );
      const text = await response.text();
      if (!path) {
        assert.match(text, /href="\/admin\/style.css"/);
        assert.match(text, /src="\/admin\/participation\/app.js"/);
        assert.doesNotMatch(text, /<script[^>]*>[^<\s]|\son\w+=|style=/);
      }
    }
    for (const path of [
      '/admin/participation',
      '/admin/participation/app.js?x=1',
      '/admin/participation/assets.test.ts',
      '/admin/participation/%2e%2e%2fparticipation.ts',
      '/admin/submissions/',
      '/admin/',
    ]) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
  } finally {
    server.close();
    await once(server, 'close');
    console.log(
      JSON.stringify({
        fixturePid: process.pid,
        fixturePort: address.port,
        closed: true,
      }),
    );
  }
});
