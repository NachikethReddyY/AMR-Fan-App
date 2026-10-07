import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createIdentityVerifier, oidcBrowserConfig } from './oidc.ts';

const config = {
  kind: 'oidc',
  issuer: 'https://identity.example.test/tenant',
  audience: 'amr-api',
  jwksUrl: 'https://identity.example.test/keys',
  scope: 'account.access',
} as const;
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let verify: ReturnType<typeof createIdentityVerifier>;
before(async () => {
  keys = await generateKeyPair('RS256');
  verify = createIdentityVerifier(
    config,
    createLocalJWKSet({
      keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'fixture' }],
    }),
  );
});
async function token(
  overrides: Record<string, unknown> = {},
  signingKey = keys.privateKey,
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: config.issuer,
    aud: config.audience,
    sub: 'provider-subject',
    iat: now,
    exp: now + 300,
    scp: config.scope,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
    .sign(signingKey);
}
test('browser config exposes only the public OIDC metadata and requires HTTPS redirect', () => {
  assert.deepEqual(
    oidcBrowserConfig(config, 'web-client', 'https://admin.example.test/admin/'),
    {
      mode: 'oidc',
      authority: 'https://identity.example.test/tenant',
      clientId: 'web-client',
      redirectUri: 'https://admin.example.test/admin/',
      scope: 'api://amr-api/account.access',
    },
  );
  assert.deepEqual(oidcBrowserConfig(config, 'web-client', 'http://evil.test/'), {
    mode: 'unavailable',
  });
});

test('verified access token returns only issuer and subject, never client roles or email identity', async () => {
  assert.deepEqual(
    await verify(
      await token({ roles: ['admin'], email: 'other@example.test' }),
    ),
    { issuer: config.issuer, subject: 'provider-subject' },
  );
});
test('verified display name is retained as display data without becoming authority', async () => {
  assert.deepEqual(
    await verify(await token({ name: 'Nachiketh Reddy', roles: ['admin'] })),
    {
      issuer: config.issuer,
      subject: 'provider-subject',
      displayName: 'Nachiketh Reddy',
    },
  );
});
test('invalid issuer/audience/time/signature/subject/scope fail closed', async () => {
  for (const claim of [
    { iss: 'https://attacker.example.test' },
    { aud: 'another-api' },
    { exp: 1 },
    { nbf: 9999999999 },
    { exp: undefined },
    { iat: undefined },
    { iat: 9999999999 },
    { sub: '' },
    { sub: undefined },
    { scp: '' },
  ])
    await assert.rejects(verify(await token(claim)), { status: 401 });
  const attacker = await generateKeyPair('RS256');
  await assert.rejects(verify(await token({}, attacker.privateKey)), {
    status: 401,
  });
  await assert.rejects(verify('invalid-token'), { status: 401 });
});
