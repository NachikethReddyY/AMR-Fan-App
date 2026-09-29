import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { testDatabaseName } from '../../../scripts/local-db.mjs';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount } from '../accounts/store.ts';
import { createApi } from '../api/app.ts';
import { createSession } from '../auth/session.ts';
import sharp from 'sharp';
if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${testDatabaseName()}`
)
  throw new Error('Owned test database required');
const pool = createDatabase();
const issuer = `urn:amr:http-test:${randomUUID()}`;
let server: any, base: string, a: any, b: any;
const provider = {
  assess: async () => ({
    category: 'active_transport',
    evidenceScore: 80,
    confidence: 0.9,
    rationale: 'bus',
    evidenceItems: ['ticket'],
    modelVersion: 'fixture',
  }),
};
let image64 = '';
async function account() {
  const x = await ensureAccount(pool, { issuer, subject: randomUUID() });
  return {
    id: x.id,
    profile: x.profiles.find((p: any) => p.kind === 'real'),
    session: (await createSession(pool, x.id)).token,
  };
}
before(async () => {
  await migrate(pool);
  image64 = (
    await sharp({
      create: {
        width: 12,
        height: 8,
        channels: 3,
        background: `#${randomUUID().replaceAll('-', '').slice(0, 6)}`,
      },
    })
      .png()
      .toBuffer()
  ).toString('base64');
  a = await account();
  b = await account();
  server = createApi({
    pool,
    env: {
      NODE_ENV: 'test',
      AUTH_ISSUER: 'https://fixture.example.test/' + issuer,
      AUTH_AUDIENCE: 'amr-api',
      AUTH_JWKS_URL: 'https://fixture.example.test/keys',
      AUTH_REQUIRED_SCOPE: 'account.access',
    },
    verifyIdentity: async (token: string) => ({ principalId: token }) as any,
    activityProvider: provider,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const ad = server.address();
  base = `http://127.0.0.1:${ad.port}`;
});
after(async () => {
  server?.close();
  // Gate 2 retains credited claims and their assessment provenance under
  // immutable-history policy; this isolated database is discarded by the
  // runner, so cleanup must not violate those foreign keys/triggers.
  await pool.end();
});
const body = (id = randomUUID()) => ({
  requestId: id,
  description: 'bus ride',
  photos: [{ mime: 'image/png', base64: image64 }],
});
const req = (
  profile: string,
  token: string,
  method = 'POST',
  value: any = body(),
) =>
  fetch(
    `${base}/v1/profiles/${profile}/activity-submissions${method === 'GET' ? '/' + value.requestId : ''}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: method === 'POST' ? JSON.stringify(value) : undefined,
    },
  );
test('anonymous rejects before body and disabled provider is unavailable', async () => {
  const r = await fetch(
    `${base}/v1/profiles/${a.profile.id}/activity-submissions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    },
  );
  assert.equal(r.status, 401);
  const capability = await fetch(
    `${base}/v1/profiles/${a.profile.id}/activity-submissions/availability`,
  );
  assert.equal(capability.status, 401);

  const disabledServer = createApi({
    pool,
    env: {
      NODE_ENV: 'test',
      AUTH_ISSUER: 'https://fixture.example.test/' + issuer,
      AUTH_AUDIENCE: 'amr-api',
      AUTH_JWKS_URL: 'https://fixture.example.test/keys',
      AUTH_REQUIRED_SCOPE: 'account.access',
    },
    verifyIdentity: async (token: string) => ({ principalId: token }) as any,
  });
  disabledServer.listen(0, '127.0.0.1');
  await once(disabledServer, 'listening');
  try {
    const address = disabledServer.address();
    const response = await fetch(
      `http://127.0.0.1:${(address as any).port}/v1/profiles/${a.profile.id}/activity-submissions/availability`,
      { headers: { Authorization: `Bearer ${a.session}` } },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      kind: 'unavailable',
      reason: 'disabled',
    });
  } finally {
    disabledServer.close();
  }
});
test('injected provider accepted then GET replay', async () => {
  const availability = await req(a.profile.id, a.session, 'GET', {
    requestId: 'availability',
  });
  assert.equal(availability.status, 200);
  assert.deepEqual(await availability.json(), {
    kind: 'available',
    mode: 'synthetic_test',
    limits: { photos: 5, description: 1600 },
  });
  const v = body();
  const r = await req(a.profile.id, a.session, 'POST', v);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.kind, 'accepted');
  // Without journeyId this versioned route owns a standalone evidence award;
  // linked submissions share the journey settlement's preliminary accounting.
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM app.photo_activity_claims WHERE profile_id=$1',
        [a.profile.id],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM app.points_operations WHERE profile_id=$1 AND kind='activity_evidence'",
        [a.profile.id],
      )
    ).rows[0].n,
    1,
  );
  const g = await req(a.profile.id, a.session, 'GET', v);
  assert.equal(g.status, 200);
  assert.equal((await g.json()).kind, 'replay');
});
test('processing recovery maps internal busy state to public unavailable result', async () => {
  const requestId = randomUUID();
  await pool.query(
    `INSERT INTO app.activity_assessments
     (id,profile_id,request_id,payload_digest,mission_id,status,image_hashes,result)
     VALUES ($1,$2,$3,$4,NULL,'processing',$5,$6)`,
    [
      randomUUID(),
      b.profile.id,
      requestId,
      'a'.repeat(64),
      JSON.stringify(['b'.repeat(64)]),
      { kind: 'unavailable', reason: 'busy' },
    ],
  );
  const response = await req(b.profile.id, b.session, 'GET', { requestId });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    kind: 'unavailable',
    reason: 'busy',
  });
});
test('same request id changed payload conflicts and cross owner denied', async () => {
  const v = body();
  let r = await req(a.profile.id, a.session, 'POST', v);
  assert.equal(r.status, 200);
  r = await req(a.profile.id, a.session, 'POST', {
    ...v,
    description: 'different',
  });
  assert.equal(r.status, 409);
  r = await req(b.profile.id, b.session, 'GET', v);
  assert.equal(r.status, 404);
});
test('demo profile is rejected', async () => {
  const acc = await ensureAccount(pool, { issuer, subject: randomUUID() });
  const demo = acc.profiles.find((p: any) => p.kind === 'demo');
  assert.ok(demo);
  const r = await req(demo.id, (await createSession(pool, acc.id)).token);
  assert.equal(r.status, 409);
});
