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

test('hosted sign-in registers the shared helper and current admin authority on participation routes', async () => {
  const { randomUUID } = await import('node:crypto');
  const { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } =
    await import('jose');
  const { createSupabaseVerifier, SUPABASE_ISSUER, SUPABASE_URL } =
    await import('../../../auth/supabase.ts');
  const { passwordSession } = await import('../../../auth/admin.js');
  const { assignRole } = await import('../../../accounts/store.ts');
  const { migrate } = await import('../../../database/migrate.ts');
  const pool = createDatabase();
  const keys = await generateKeyPair('ES256');
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    iss: SUPABASE_ISSUER,
    aud: 'authenticated',
    sub: randomUUID(),
    iat: now,
    exp: now + 300,
    role: 'authenticated',
    is_anonymous: false,
    session_id: randomUUID(),
    user_metadata: { role: 'admin' },
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'local-participation' })
    .sign(keys.privateKey);
  const server = createApi({
    pool,
    env: {
      NODE_ENV: 'test',
      AUTH_PROVIDER: 'supabase',
      AUTH_DEV_ENABLED: 'false',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'fixture'.repeat(3),
      ADMIN_ORIGIN: 'https://render.example.test',
      ADMIN_ADDITIONAL_ORIGIN: 'https://admin.example.test',
    },
    verifyIdentity: createSupabaseVerifier(
      createLocalJWKSet({
        keys: [
          { ...(await exportJWK(keys.publicKey)), kid: 'local-participation' },
        ],
      }),
    ),
  });
  try {
    await migrate(pool);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const config = await (await fetch(base + '/admin/config')).json();
    assert.equal(config.synthetic, false);
    const html = await fetch(base + '/admin/participation/');
    assert.match(
      html.headers.get('content-security-policy') ?? '',
      /connect-src 'self' https:\/\/folakoxsilrfemctvlxj\.supabase\.co;/,
    );
    assert.match(await html.text(), /id="password-signin"/);
    const app = await (
      await fetch(base + '/admin/participation/app.js')
    ).text();
    const helperImport = app.match(
      /import \{ bindPasswordSignIn \} from '([^']+)'/,
    );
    assert.ok(helperImport);
    const helper = new URL(
      helperImport[1],
      base + '/admin/participation/app.js',
    );
    assert.equal(helper.pathname, '/auth/admin.js');
    assert.equal(
      await (await fetch(helper)).text(),
      await readFile(
        new URL('../../../auth/admin.js', import.meta.url),
        'utf8',
      ),
    );
    let providerCalls = 0;
    const token = await passwordSession(
      config.auth,
      'synthetic@example.test',
      'synthetic-only',
      async (input, init) => {
        if (
          String(input) ===
          SUPABASE_URL + '/auth/v1/token?grant_type=password'
        ) {
          providerCalls++;
          assert.deepEqual(JSON.parse(String(init?.body)), {
            email: 'synthetic@example.test',
            password: 'synthetic-only',
          });
          return Response.json({
            access_token: jwt,
            refresh_token: 'discarded',
          });
        }
        assert.equal(input, '/v1/session');
        assert.equal(init?.body, undefined);
        return fetch(base + input, init);
      },
    );
    assert.equal(providerCalls, 1);
    const headers = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
    const requestId = randomUUID();
    const create = () =>
      fetch(base + '/v1/admin/submission-sessions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ requestId }),
      });
    assert.equal((await create()).status, 403);
    for (const origin of [
      'https://render.example.test',
      'https://admin.example.test',
    ]) {
      const denied = await fetch(base + '/v1/admin/session', {
        headers: { ...headers, Origin: origin },
      });
      assert.equal(denied.status, 403);
      assert.equal(
        (await denied.json()).error,
        'Assigned admin access required.',
      );
    }
    const account = await (await fetch(base + '/v1/me', { headers })).json();
    await assignRole(
      pool,
      account.id,
      'admin',
      'Owned hosted participation fixture',
    );
    for (const origin of [
      'https://render.example.test',
      'https://admin.example.test',
    ]) {
      assert.equal(
        (
          await fetch(base + '/v1/admin/session', {
            headers: { ...headers, Origin: origin },
          })
        ).status,
        200,
      );
    }
    const original = await create();
    assert.equal(original.status, 201);
    const receipt = await original.json();
    assert.deepEqual(await (await create()).json(), receipt);
    await assignRole(
      pool,
      account.id,
      'fan',
      'Owned hosted participation role revocation',
    );
    assert.equal((await create()).status, 403);
    for (const origin of [
      'https://render.example.test',
      'https://admin.example.test',
    ]) {
      const denied = await fetch(base + '/v1/admin/session', {
        headers: { ...headers, Origin: origin },
      });
      assert.equal(denied.status, 403);
      assert.equal(
        (await denied.json()).error,
        'Assigned admin access required.',
      );
    }
    await fetch(base + '/v1/session', { method: 'DELETE', headers });
    assert.equal((await create()).status, 401);
  } finally {
    if (server.listening) {
      server.close();
      await once(server, 'close');
    }
    await pool.end();
  }
});
