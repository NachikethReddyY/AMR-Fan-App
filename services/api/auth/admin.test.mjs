import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadAdminConfig, oidcAuthorizeUrl, passwordSession } from './admin.js';
const config = {
  mode: 'supabase',
  url: 'https://folakoxsilrfemctvlxj.supabase.co',
  publishableKey: 'sb_publishable_' + 'fixture'.repeat(3),
};
test('admin config falls back while the API wakes from sleep', async () => {
  let calls = 0;
  const result = await loadAdminConfig(async (_url, init) => {
    calls++;
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    return new Response('warming up', { status: 503 });
  });
  assert.equal(result.synthetic, false);
  assert.equal(result.auth.mode, 'unavailable');
  assert.equal(calls, 1);
});

test('OIDC authorize URL uses PKCE and the configured web redirect', () => {
  const url = new URL(
    oidcAuthorizeUrl(
      {
        mode: 'oidc',
        authority: 'https://login.example.test/tenant',
        clientId: 'client-id',
        redirectUri: 'https://admin.example.test/admin/',
        scope: 'api://api-id/account.access',
      },
      'state-value',
      'challenge-value',
    ),
  );
  assert.equal(url.origin, 'https://login.example.test');
  assert.equal(url.pathname, '/tenant/oauth2/v2.0/authorize');
  assert.equal(
    url.searchParams.get('redirect_uri'),
    'https://admin.example.test/admin/',
  );
  assert.equal(url.searchParams.get('code_challenge'), 'challenge-value');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
});

test('email/password goes only to fixed identity provider, then token exchanges for app session', async () => {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return calls.length === 1
      ? Response.json({
          access_token: 'synthetic.jwt.token',
          refresh_token: 'discard-me',
          user: { role: 'admin' },
        })
      : Response.json({ token: 'a'.repeat(43) });
  };
  assert.equal(
    await passwordSession(
      config,
      'fan@example.test',
      'synthetic-password',
      request,
    ),
    'a'.repeat(43),
  );
  assert.equal(calls[0].url, config.url + '/auth/v1/token?grant_type=password');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email: 'fan@example.test',
    password: 'synthetic-password',
  });
  assert.equal(calls[1].url, '/v1/session');
  assert.equal(calls[1].init.body, undefined);
  assert.equal(
    calls[1].init.headers.Authorization,
    'Bearer synthetic.jwt.token',
  );
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[1].init.redirect, 'error');
  assert.equal(calls[1].init.credentials, 'include');
});
test('unsafe provider/key/missing credentials refuse without any network call; provider error is sanitized', async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    return new Response('private provider details', { status: 400 });
  };
  for (const value of [
    { ...config, url: 'https://attacker.test' },
    { ...config, publishableKey: 'sb_secret_invalid' },
    { ...config, mode: 'oidc' },
  ])
    await assert.rejects(
      passwordSession(value, 'e@x.test', 'synthetic', request),
    );
  assert.equal(calls, 0);
  await assert.rejects(
    passwordSession(config, 'e@x.test', 'synthetic', request),
    { message: 'Sign-in failed. Check your email and password.' },
  );
});
