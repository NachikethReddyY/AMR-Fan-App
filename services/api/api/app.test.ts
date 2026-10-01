import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { createApi } from './app.ts';
import { createIdentityVerifier } from '../auth/oidc.ts';
import { assignRole } from '../accounts/store.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use this worktree test database.');
const pool = createDatabase();
const config = {
  kind: 'oidc',
  issuer: `https://fixture.example.test/${randomUUID()}`,
  audience: 'amr-api',
  jwksUrl: 'https://fixture.example.test/keys',
  scope: 'account.access',
} as const;
const env = {
  NODE_ENV: 'test',
  AUTH_ISSUER: config.issuer,
  AUTH_AUDIENCE: config.audience,
  AUTH_JWKS_URL: config.jwksUrl,
  AUTH_REQUIRED_SCOPE: config.scope,
};
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let server: ReturnType<typeof createApi>;
let base = '';
let a: {
  token: string;
  expiresAt: string;
  account: {
    id: string;
    role: string;
    profiles: {
      id: string;
      kind: string;
      balance: number;
      displayName: string;
    }[];
  };
};
let b: typeof a;
async function start() {
  const verifier = createIdentityVerifier(
    config,
    createLocalJWKSet({
      keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'fixture' }],
    }),
  );
  server = createApi({ pool, env, verifyIdentity: verifier });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
}
async function token(
  subject: string,
  claims: Record<string, unknown> = {},
  key = keys.privateKey,
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: config.issuer,
    aud: config.audience,
    sub: subject,
    iat: now,
    exp: now + 300,
    scp: config.scope,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
    .sign(key);
}
async function request(
  path: string,
  credential?: string,
  method = 'GET',
  data?: unknown,
) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}
before(async () => {
  await migrate(pool);
  keys = await generateKeyPair('RS256');
  await start();
});
after(async () => {
  if (server) {
    server.close();
    await once(server, 'close');
  }
  await pool.query('DELETE FROM app.principals WHERE issuer = $1', [
    config.issuer,
  ]);
  await pool.end();
});

test('HTTP rejects anonymous, invalid, expired, wrong issuer/audience/signature tokens and synthetic bypass', async () => {
  assert.equal((await request('/v1/me')).status, 401);
  for (const claims of [
    { exp: 1 },
    { aud: 'other-api' },
    { iss: 'https://other.test' },
    { nbf: 9999999999 },
    { scp: '' },
  ]) {
    assert.equal(
      (await request('/v1/session', await token('a', claims), 'POST')).status,
      401,
    );
  }
  const attacker = await generateKeyPair('RS256');
  assert.equal(
    (
      await request(
        '/v1/session',
        await token('a', {}, attacker.privateKey),
        'POST',
      )
    ).status,
    401,
  );
  assert.equal((await request('/v1/session', 'forged', 'POST')).status, 401);
  assert.equal(
    (await request('/v1/dev/session', undefined, 'POST', { fixture: 'fan-a' }))
      .status,
    404,
  );
});
test('health is liveness while ready reports database dependency state', async () => {
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const ready = await request('/ready');
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), {
    status: 'ready',
    dependencies: { database: 'ok' },
  });

  const unavailable = createApi({
    pool: {
      query: async () => {
        throw new Error('synthetic database outage');
      },
    } as never,
    env,
  });
  unavailable.listen(0, '127.0.0.1');
  await once(unavailable, 'listening');
  const address = unavailable.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const unavailableHealth = await fetch(
      `http://127.0.0.1:${address.port}/health`,
    );
    assert.equal(unavailableHealth.status, 200);
    const unavailableReady = await fetch(
      `http://127.0.0.1:${address.port}/ready`,
    );
    assert.equal(unavailableReady.status, 503);
    assert.deepEqual(await unavailableReady.json(), {
      status: 'unavailable',
      dependencies: { database: 'unavailable' },
    });
  } finally {
    unavailable.close();
    await once(unavailable, 'close');
  }
});
test('HTTP concurrent first sign-ins create one zero-balance real/demo account, ignore forged roles', async () => {
  const credential = await token('a', {
    role: 'admin',
    roles: ['admin'],
    accountId: randomUUID(),
  });
  const responses = await Promise.all(
    Array.from({ length: 8 }, () => request('/v1/session', credential, 'POST')),
  );
  for (const response of responses) assert.equal(response.status, 201);
  const results = await Promise.all(
    responses.map((response) => response.json()),
  );
  a = results[0];
  assert.equal(new Set(results.map((result) => result.account.id)).size, 1);
  assert.deepEqual(
    a.account.profiles.map((p) => [p.kind, p.balance]),
    [
      ['real', 0],
      ['demo', 0],
    ],
  );
  assert.equal(a.account.role, 'fan');
  b = await (await request('/v1/session', await token('b'), 'POST')).json();
  assert.notEqual(a.account.id, b.account.id);
  const sessions = await pool.query(
    'SELECT token_hash FROM app.sessions WHERE principal_id = $1',
    [a.account.id],
  );
  assert.ok(
    sessions.rows.some(
      (row) =>
        row.token_hash === createHash('sha256').update(a.token).digest('hex'),
    ),
  );
  assert.ok(sessions.rows.every((row) => row.token_hash !== a.token));
});
test('two-account reads/writes deny foreign paths, reject untrusted body ownership and roles', async () => {
  const path = `/v1/profiles/${a.account.profiles[0].id}`;
  assert.equal((await request(path, b.token)).status, 404);
  assert.equal(
    (await request(path, b.token, 'PATCH', { displayName: 'Intruder' })).status,
    404,
  );
  for (const fields of [
    { ownerId: b.account.id },
    { role: 'admin' },
    { balance: 999 },
    { kind: 'demo' },
  ]) {
    assert.equal(
      (await request(path, a.token, 'PATCH', { displayName: 'Fan', ...fields }))
        .status,
      400,
    );
  }
  assert.equal((await request('/v1/profiles/not-a-uuid', a.token)).status, 404);
  assert.equal(
    (
      await request(path, a.token, 'PATCH', {
        displayName: 'Persistent profile',
      })
    ).status,
    200,
  );
  assert.equal(
    (await (await request(path, a.token)).json()).displayName,
    'Persistent profile',
  );
  assert.equal(
    (
      await (
        await request(`/v1/profiles/${b.account.profiles[0].id}`, b.token)
      ).json()
    ).displayName,
    'Fan',
  );
});
test('assigned-admin checks re-read stored role on every request', async () => {
  assert.equal((await request('/v1/admin/session', a.token)).status, 403);
  await assignRole(pool, a.account.id, 'admin', 'Synthetic authorization test');
  assert.equal((await request('/v1/admin/session', a.token)).status, 200);
  assert.equal((await request('/v1/admin/session', b.token)).status, 403);
  assert.equal(
    (await request(`/v1/profiles/${b.account.profiles[0].id}`, a.token)).status,
    404,
  );
  await assignRole(pool, a.account.id, 'fan', 'End synthetic assignment');
  assert.equal((await request('/v1/admin/session', a.token)).status, 403);
});
test('server restart and another device resume persisted profile; logout revokes only that session', async () => {
  server.close();
  await once(server, 'close');
  await start();
  assert.equal((await request('/v1/me', a.token)).status, 200);
  const another = await (
    await request('/v1/session', await token('a'), 'POST')
  ).json();
  assert.equal(another.account.id, a.account.id);
  assert.equal(another.account.profiles[0].displayName, 'Persistent profile');
  assert.equal((await request('/v1/session', a.token, 'DELETE')).status, 200);
  assert.equal((await request('/v1/me', a.token)).status, 401);
  assert.equal((await request('/v1/me', another.token)).status, 200);
  await pool.query(
    "UPDATE app.sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1",
    [createHash('sha256').update(another.token).digest('hex')],
  );
  assert.equal((await request('/v1/me', another.token)).status, 401);
});

test('synthetic fixture selectors cannot supply identity/role and production startup rejects verifier overrides', async () => {
  assert.throws(() =>
    createApi({
      pool,
      env: {
        ...env,
        NODE_ENV: 'production',
        AUTH_DEV_ENABLED: 'true',
        API_HOST: '127.0.0.1',
      },
    }),
  );
  assert.throws(() =>
    createApi({
      pool,
      env: { ...env, NODE_ENV: 'production' },
      verifyIdentity: async () => ({ issuer: 'forged', subject: 'forged' }),
    }),
  );
  const local = createApi({
    pool,
    env: { NODE_ENV: 'test', AUTH_DEV_ENABLED: 'true', API_HOST: '127.0.0.1' },
  });
  local.listen(0, '127.0.0.1');
  await once(local, 'listening');
  const address = local.address();
  assert.ok(address && typeof address !== 'string');
  try {
    for (const body of [
      { fixture: 'admin' },
      { fixture: 'fan-a', role: 'admin' },
      { issuer: 'mine', subject: 'mine' },
      { fixture: '__proto__' },
    ]) {
      const response: Response = await fetch(
        `http://127.0.0.1:${address.port}/v1/dev/session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      assert.equal(response.status, 400);
    }
  } finally {
    local.close();
    await once(local, 'close');
  }
});

test('HTTP input sizes and types are rejected without changing account state', async () => {
  const path = `/v1/profiles/${b.account.profiles[0].id}`;
  for (const data of [
    { displayName: '' },
    { displayName: '\u0000bad' },
    { displayName: 42 },
    ['name'],
  ]) {
    assert.equal((await request(path, b.token, 'PATCH', data)).status, 400);
  }
  assert.equal(
    (await request(path, b.token, 'PATCH', { displayName: 'x'.repeat(5000) }))
      .status,
    413,
  );
  assert.equal(
    (
      await fetch(base + path, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${b.token}`,
          'Content-Type': 'application/json',
        },
        body: '{',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(base + path, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${b.token}`,
          'Content-Type': 'text/plain',
        },
        body: 'name',
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await fetch(base + '/v1/me', {
        headers: {
          Authorization: `Bearer ${b.token}`,
          Origin: 'https://untrusted.example.test',
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (await (await request(path, b.token)).json()).displayName,
    'Fan',
  );
});
