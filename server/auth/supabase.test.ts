import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { authConfig } from './config.ts';
import { createSupabaseVerifier, SUPABASE_ISSUER } from './supabase.ts';

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let verify: ReturnType<typeof createSupabaseVerifier>;
before(async () => {
  keys = await generateKeyPair('ES256');
  verify = createSupabaseVerifier(
    createLocalJWKSet({
      keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'fixture' }],
    }),
  );
});
async function token(
  overrides: Record<string, unknown> = {},
  key = keys.privateKey,
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: SUPABASE_ISSUER,
    aud: 'authenticated',
    sub: '11111111-1111-4111-8111-111111111111',
    session_id: '22222222-2222-4222-8222-222222222222',
    role: 'authenticated',
    is_anonymous: false,
    iat: now,
    exp: now + 3600,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'fixture', typ: 'JWT' })
    .sign(key);
}
test('exact project identity is verified without importing client role claims', async () => {
  assert.deepEqual(
    await verify(
      await token({
        user_metadata: { role: 'admin' },
        email: 'untrusted@example.test',
      }),
    ),
    {
      issuer: SUPABASE_ISSUER,
      subject: '11111111-1111-4111-8111-111111111111',
    },
  );
});
test('Supabase refuses wrong authority, privileges, signature and incomplete or stale identity', async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const claims of [
    { iss: 'https://other.supabase.co/auth/v1' },
    { aud: 'other' },
    { aud: ['authenticated', 'other'] },
    { role: 'service_role' },
    { role: 'anon' },
    { is_anonymous: true },
    { is_anonymous: undefined },
    { sub: 'not-a-uuid' },
    { sub: undefined },
    { session_id: undefined },
    { session_id: 'not-a-uuid' },
    { exp: 1 },
    { exp: undefined },
    { iat: undefined },
    { iat: now + 60 },
    { exp: now + 86401 },
    { nbf: now + 60 },
  ])
    await assert.rejects(verify(await token(claims)), { status: 401 });
  const foreign = await generateKeyPair('ES256');
  await assert.rejects(verify(await token({}, foreign.privateKey)), {
    status: 401,
  });
  await assert.rejects(verify('x'.repeat(16385)), { status: 401 });
  const rsa = await generateKeyPair('RS256');
  await assert.rejects(
    verify(
      await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256' })
        .sign(rsa.privateKey),
    ),
    { status: 401 },
  );
});
test('Supabase provider is explicit and cannot change trusted project or enable public synthetic auth', () => {
  const env = {
    NODE_ENV: 'production',
    AUTH_PROVIDER: 'supabase',
    AUTH_DEV_ENABLED: 'false',
    API_HOST: '0.0.0.0',
  };
  assert.deepEqual(authConfig(env), { kind: 'supabase' });
  assert.throws(() => authConfig({ ...env, AUTH_PROVIDER: 'unknown' }));
  assert.throws(() => authConfig({ ...env, AUTH_DEV_ENABLED: 'true' }));
  assert.throws(() =>
    authConfig({ ...env, AUTH_ISSUER: 'https://other.supabase.co/auth/v1' }),
  );
});
