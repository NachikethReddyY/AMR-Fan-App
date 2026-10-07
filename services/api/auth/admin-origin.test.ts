import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { Pool } from 'pg';
import { createApi } from '../api/app.ts';

const env = {
  NODE_ENV: 'test',
  AUTH_PROVIDER: 'supabase',
  ADMIN_ORIGIN: 'https://amr-fan-app.onrender.com',
  ADMIN_ADDITIONAL_ORIGIN: 'https://admin.example.test',
};

test('existing and added exact origins retain browser access without granting authority', async () => {
  // These routes finish before database I/O. No database is provisioned or contacted.
  const pool = new Pool({
    connectionString: 'postgres://unused:unused@127.0.0.1:1/unused',
  });
  const server = createApi({ pool, env });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const origin of [
      undefined,
      env.ADMIN_ORIGIN,
      env.ADMIN_ADDITIONAL_ORIGIN,
    ]) {
      const headers = new Headers();
      if (origin) headers.set('Origin', origin);
      assert.equal(
        (await fetch(base + '/admin/config', { headers })).status,
        200,
      );
      assert.equal(
        (await fetch(base + '/v1/admin/session', { headers })).status,
        401,
      );
      assert.equal(
        (await fetch(base + '/v1/session', { method: 'POST', headers })).status,
        401,
      );
    }
    for (const origin of [
      'https://evil.test',
      'null',
      'https://preview.vercel.app',
      env.ADMIN_ADDITIONAL_ORIGIN + '.evil.test',
    ]) {
      const response: Response = await fetch(base + '/admin/config', {
        headers: { Origin: origin },
      });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    }
  } finally {
    server.close();
    await once(server, 'close');
    await pool.end();
  }
});

test('OIDC deployment exposes public browser config without changing server authorization', async () => {
  const pool = new Pool({
    connectionString: 'postgres://unused:unused@127.0.0.1:1/unused',
  });
  const server = createApi({
    pool,
    env: {
      NODE_ENV: 'production',
      AUTH_PROVIDER: 'oidc',
      AUTH_ISSUER: 'https://identity.example.test/tenant/v2.0',
      AUTH_AUDIENCE: 'api-id',
      AUTH_JWKS_URL: 'https://identity.example.test/keys',
      AUTH_REQUIRED_SCOPE: 'account.access',
      ADMIN_ORIGIN: 'https://admin.example.test',
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/admin/config`, {
      headers: { Origin: 'https://admin.example.test' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).auth, {
      mode: 'oidc',
      authority: 'https://identity.example.test/tenant',
      clientId: '616286cc-a22b-49a2-b5a3-27011fd615a1',
      redirectUri: 'https://admin.example.test/admin/',
      scope: 'api://api-id/account.access',
    });
  } finally {
    server.close();
    await once(server, 'close');
    await pool.end();
  }
});

test('additional origin rejects wildcard, credentials, insecure and non-origin settings', async () => {
  const pool = new Pool();
  try {
    for (const origin of [
      '*',
      'null',
      'not-an-origin',
      'https://*.vercel.app',
      'http://admin.example.test',
      'https://user:pass@example.test',
      'https://admin.example.test/',
      'https://admin.example.test/path',
    ]) {
      for (const name of ['ADMIN_ORIGIN', 'ADMIN_ADDITIONAL_ORIGIN'])
        assert.throws(() =>
          createApi({ pool, env: { ...env, [name]: origin } }),
        );
    }
  } finally {
    await pool.end();
  }
});

test('unset additional origin preserves the single-origin and native client contract', async () => {
  const pool = new Pool();
  const server = createApi({
    pool,
    env: { ...env, ADMIN_ADDITIONAL_ORIGIN: undefined },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    for (const [origin, status] of [
      [undefined, 200],
      [env.ADMIN_ORIGIN, 200],
      [env.ADMIN_ADDITIONAL_ORIGIN, 403],
      ['null', 403],
      ['not-an-origin', 403],
      ['https://amr-fan-app.onrender.com.evil.test', 403],
    ] as const) {
      const response: Response = await fetch(
        `http://127.0.0.1:${address.port}/admin/config`,
        {
          headers: new Headers(origin ? [['Origin', origin]] : []),
        },
      );
      assert.equal(response.status, status);
    }
  } finally {
    server.close();
    await once(server, 'close');
    await pool.end();
  }
});
