import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { once } from 'node:events';
import { createServer } from 'node:http';
import pg from 'pg';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createApi } from '../../server/api/app.ts';
import {
  createSupabaseVerifier,
  SUPABASE_ISSUER,
  SUPABASE_URL,
} from '../../server/auth/supabase.ts';
import { passwordSession } from '../../server/auth/admin.js';
import { bootstrapDatabase } from './supabase-database.mjs';
if (process.env.AMR_OPS123_DISPOSABLE !== 'true')
  throw new Error('Owned disposable fixture only.');
const password = (await readFile('/run/amr-test/password', 'utf8')).trim();
const admin = new pg.Pool({
  host: '127.0.0.1',
  user: 'postgres',
  database: 'postgres',
  password,
  max: 2,
});
const pool = new pg.Pool({
  host: '127.0.0.1',
  user: 'amr_api',
  database: 'postgres',
  password,
  max: 5,
});
async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
}
test('real HTTP email/password exchange, DB-owned roles, replay denial and conditional CSP', async () => {
  let api, provider;
  try {
    await bootstrapDatabase(admin, password);
    const keys = await generateKeyPair('ES256'),
      now = Math.floor(Date.now() / 1000);
    const subject = '33333333-3333-4333-8333-333333333333';
    const jwt = await new SignJWT({
      iss: SUPABASE_ISSUER,
      aud: 'authenticated',
      sub: subject,
      iat: now,
      exp: now + 300,
      role: 'authenticated',
      is_anonymous: false,
      session_id: '44444444-4444-4444-8444-444444444444',
      user_metadata: { role: 'admin' },
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'local' })
      .sign(keys.privateKey);
    const verify = createSupabaseVerifier(
      createLocalJWKSet({
        keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'local' }],
      }),
    );
    const env = {
      NODE_ENV: 'test',
      AUTH_PROVIDER: 'supabase',
      AUTH_DEV_ENABLED: 'false',
      API_HOST: '127.0.0.1',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'fixture'.repeat(3),
    };
    api = createApi({ pool, env, verifyIdentity: verify });
    const base = await listen(api);
    provider = createServer(async (req, res) => {
      assert.equal(req.url, '/auth/v1/token?grant_type=password');
      let text = '';
      for await (const chunk of req) text += chunk;
      const input = JSON.parse(text);
      assert.equal(input.email, 'synthetic@example.test');
      assert.equal(input.password, 'synthetic-only');
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({ access_token: jwt, refresh_token: 'discarded' }),
      );
    });
    const identity = await listen(provider);
    const request = (url, options) =>
      fetch(
        url.startsWith(SUPABASE_URL)
          ? url.replace(SUPABASE_URL, identity)
          : base + url,
        options,
      );
    const config = await (await fetch(base + '/admin/config')).json();
    assert.equal(config.synthetic, false);
    assert.deepEqual(Object.keys(config.auth).sort(), [
      'mode',
      'publishableKey',
      'url',
    ]);
    const session = await passwordSession(
      config.auth,
      'synthetic@example.test',
      'synthetic-only',
      request,
    );
    const auth = { Authorization: `Bearer ${session}` };
    assert.equal(
      (await fetch(base + '/v1/admin/session', { headers: auth })).status,
      403,
    );
    const me = await (await fetch(base + '/v1/me', { headers: auth })).json();
    assert.equal(me.role, 'fan');
    assert.equal(me.profiles.length, 2);
    assert.ok(me.profiles.every((p) => p.balance === 0));
    assert.equal(
      (await fetch(base + '/v1/dev/session', { method: 'POST' })).status,
      404,
    );
    const bad = await fetch(base + '/v1/session', {
      method: 'POST',
      headers: { Authorization: 'Bearer forged' },
    });
    assert.equal(bad.status, 401);
    const again = await passwordSession(
      config.auth,
      'synthetic@example.test',
      'synthetic-only',
      request,
    );
    const same = await (
      await fetch(base + '/v1/me', {
        headers: { Authorization: `Bearer ${again}` },
      })
    ).json();
    assert.equal(same.id, me.id);
    // Synthetic fixture only, never assigns a real cloud administrator.
    await admin.query(
      "UPDATE app.principals SET role='admin' WHERE subject=$1",
      [subject],
    );
    assert.equal(
      (await fetch(base + '/v1/admin/session', { headers: auth })).status,
      200,
    );
    for (const path of [
      '/admin/',
      '/admin/submissions/',
      '/admin/rewards/',
      '/admin/reports/',
    ]) {
      const page = await fetch(base + path);
      assert.equal(page.status, 200);
      assert.ok(
        page.headers
          .get('content-security-policy')
          .includes("connect-src 'self' " + SUPABASE_URL),
      );
      assert.ok((await page.text()).includes('id="password-signin"'));
      const assetUrl = base + path + 'app.js';
      const source = await (await fetch(assetUrl)).text();
      const helperImport = source.match(/from '([^']+auth\/admin\.js)'/);
      assert.ok(helperImport);
      assert.equal(
        new URL(helperImport[1], assetUrl).pathname,
        '/auth/admin.js',
      );
    }
    const helper = await fetch(base + '/auth/admin.js');
    assert.equal(helper.status, 200);
    assert.match(await helper.text(), /passwordSession/);
    await admin.query("UPDATE app.principals SET role='fan' WHERE subject=$1", [
      subject,
    ]);
    assert.equal(
      (await fetch(base + '/v1/admin/session', { headers: auth })).status,
      403,
    );
    assert.equal(
      (await fetch(base + '/v1/session', { method: 'DELETE', headers: auth }))
        .status,
      200,
    );
    assert.equal((await fetch(base + '/v1/me', { headers: auth })).status, 401);
    assert.throws(
      () =>
        createApi({
          pool,
          env: { ...env, NODE_ENV: 'production' },
          verifyIdentity: verify,
        }),
      /test-only/,
    );
    await close(provider);
    provider = undefined;
    await close(api);
    api = undefined;
    for (const variant of [
      { ...env, SUPABASE_PUBLISHABLE_KEY: undefined },
      { ...env, AUTH_DEV_ENABLED: 'true' },
    ]) {
      api = createApi({ pool, env: variant, verifyIdentity: verify });
      const localBase = await listen(api);
      const localConfig = await (
        await fetch(localBase + '/admin/config')
      ).json();
      assert.equal(localConfig.auth.mode, 'unavailable');
      assert.equal(localConfig.synthetic, variant.AUTH_DEV_ENABLED === 'true');
      for (const path of [
        '/admin/',
        '/admin/submissions/',
        '/admin/rewards/',
        '/admin/reports/',
      ]) {
        const page = await fetch(localBase + path);
        assert.equal(
          page.headers.get('content-security-policy'),
          "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
        );
      }
      await close(api);
      api = undefined;
    }
  } finally {
    if (provider) await close(provider);
    if (api) await close(api);
    await pool.end();
    await admin.query(
      'DROP SCHEMA IF EXISTS app CASCADE; DROP TABLE IF EXISTS public.schema_migrations',
    );
    for (const name of ['amr_api', 'amr_migration_owner'])
      if (
        (await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [name]))
          .rowCount
      )
        await admin.query(`DROP OWNED BY ${name} CASCADE; DROP ROLE ${name}`);
    await admin.end();
  }
});
