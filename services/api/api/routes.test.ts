import { fileURLToPath } from 'node:url';
import { parseComparison } from '../../../apps/fan/src/features/routes/api.ts';
import { projectPlanDisplay } from '../journeys/planning.ts';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount, assignRole } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';
import { createApi } from './app.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use this worktree test database.');

async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server | undefined) {
  if (!server?.listening) return;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  assert.equal(server.listening, false);
}

test('registered route HTTP authenticates persisted sessions before spending; revocation/input/rate guards preserve accounts', async () => {
  const pool = createDatabase();
  const issuer = `urn:amr:route-http:${randomUUID()}`;
  let calls = 0;
  const upstream = createServer(async (req, res) => {
    calls++;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(req.headers['x-goog-api-key'], 'amr-synthetic-routes');
    assert.equal(body.travelMode, 'DRIVE');
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        routes: [
          {
            distanceMeters: 10000,
            duration: '1800s',
            polyline: { encodedPolyline: 'o}zFoezxRo}@?' },
            legs: [
              {
                startLocation: {
                  latLng: { latitude: 1.29, longitude: 103.85 },
                },
                endLocation: { latLng: { latitude: 1.3, longitude: 103.85 } },
                steps: [
                  {
                    travelMode: 'DRIVE',
                    distanceMeters: 10000,
                    staticDuration: '1800s',
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
  });
  let api: Server | undefined;
  const auth = {
    NODE_ENV: 'test',
    AUTH_ISSUER: 'https://unprovisioned.example.test',
    AUTH_AUDIENCE: 'amr-api',
    AUTH_JWKS_URL: 'https://unprovisioned.example.test/keys',
    AUTH_REQUIRED_SCOPE: 'account.access',
  };
  try {
    await migrate(pool);
    const a = await ensureAccount(pool, { issuer, subject: 'a' }),
      b = await ensureAccount(pool, { issuer, subject: 'b' });
    const sessionA = await createSession(pool, a.id),
      sessionB = await createSession(pool, b.id);
    const providerBase = await listen(upstream);
    api = createApi({
      pool,
      env: {
        ...auth,
        AMR_ROUTES_SYNTHETIC: 'true',
        AMR_GOOGLE_ROUTES_ENDPOINT: `${providerBase}/directions/v2:computeRoutes`,
      },
    });
    let base = await listen(api);
    const input = {
      origin: 'Marina Bay Sands, Singapore',
      destination: 'Singapore Botanic Gardens',
      modes: ['DRIVE'],
      extraMinutes: 10,
    };
    const request = (
      token?: string,
      body: unknown = input,
      headers: Record<string, string> = {},
    ) =>
      fetch(`${base}/v1/routes/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: JSON.stringify(body),
      });
    for (const token of [undefined, 'forged', 'a'.repeat(43)])
      assert.equal((await request(token)).status, 401);
    assert.equal(calls, 0);
    for (const body of [
      { ...input, accountId: b.id },
      { ...input, profileId: b.profiles[0].id },
      { ...input, role: 'admin' },
      { ...input, modes: ['CAB'] },
      { ...input, origin: { latitude: Infinity, longitude: 0 } },
    ])
      assert.equal((await request(sessionA.token, body)).status, 400);
    assert.equal(
      (await request(sessionA.token, { ...input, origin: 'x'.repeat(5000) }))
        .status,
      413,
    );
    assert.equal(
      (await request(sessionA.token, input, { 'Content-Type': 'text/plain' }))
        .status,
      415,
    );
    assert.equal(
      (
        await request(sessionA.token, input, {
          Origin: 'https://untrusted.example.test',
        })
      ).status,
      403,
    );
    assert.equal(calls, 0);
    const started = performance.now();
    const result = await request(sessionA.token);
    assert.equal(result.status, 200);
    const text = await result.text();
    const payload = JSON.parse(text);
    const decoded = parseComparison(payload);
    assert.equal(decoded.calculationStatus, 'indicative_demo');
    assert.equal(payload.factorRelease, undefined);
    assert.equal(payload.result.source.kind, 'fixture');
    assert.equal(payload.result.routes[0].mode, 'car');
    assert.equal(payload.recommendation.kind, 'recommended');
    assert.equal(
      payload.result.evidence[0].routeId,
      payload.result.routes[0].id,
    );
    assert.ok(!text.includes('amr-synthetic-routes'));
    assert.equal(result.headers.get('cache-control'), 'no-store');
    process.stdout.write(
      JSON.stringify({
        sample: 1,
        routeHttpMs: performance.now() - started,
        responseBytes: Buffer.byteLength(text),
        upstreamCalls: calls,
        source: 'synthetic',
      }) + '\n',
    );
    for (let i = 0; i < 5; i++)
      assert.equal((await request(sessionA.token)).status, 200);
    assert.equal((await request(sessionA.token)).status, 429);
    assert.equal(calls, 6);
    // Another principal has its own bounded counter; client fields cannot select it.
    assert.equal((await request(sessionB.token)).status, 200);
    assert.equal(calls, 7);
    await assignRole(pool, b.id, 'admin', 'Synthetic route role regression');
    assert.equal((await request(sessionB.token)).status, 200);
    await assignRole(pool, b.id, 'fan', 'End synthetic route role assignment');
    assert.equal((await request(sessionB.token)).status, 200);
    const beforeRevoke = calls;
    assert.equal(
      (
        await fetch(`${base}/v1/session`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${sessionB.token}` },
        })
      ).status,
      200,
    );
    assert.equal((await request(sessionB.token)).status, 401);
    assert.equal(calls, beforeRevoke);
    await pool.query(
      "UPDATE app.sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
      [createHash('sha256').update(sessionA.token).digest('hex')],
    );
    assert.equal((await request(sessionA.token)).status, 401);
    assert.equal(calls, beforeRevoke);
    await close(api);
    api = createApi({ pool, env: auth });
    base = await listen(api);
    const resumed = await createSession(pool, a.id);
    const unavailable = await request(resumed.token);
    assert.equal(unavailable.status, 200);
    const unavailablePayload = await unavailable.json();
    assert.equal(
      parseComparison(unavailablePayload).calculationStatus,
      'indicative_demo',
    );
    assert.deepEqual(unavailablePayload.result, {
      kind: 'unavailable',
      reason: 'live_not_configured',
    });
    assert.equal(calls, beforeRevoke);
    // Explicit reviewed configuration is staged for the compatible native client.
    // It is never selected merely because the factor artifact is bundled.
    await close(api);
    api = createApi({
      pool,
      env: {
        ...auth,
        AMR_ROUTES_SYNTHETIC: 'true',
        AMR_GOOGLE_ROUTES_ENDPOINT: `${providerBase}/directions/v2:computeRoutes`,
        JOURNEY_FACTOR_RELEASE_FILE: fileURLToPath(
          new URL(
            '../awards/factors/cag-surface-access-co2-v1.json',
            import.meta.url,
          ),
        ),
      },
    });
    base = await listen(api);
    const configured = await request(resumed.token);
    assert.equal(configured.status, 200);
    const co2 = await configured.json();
    assert.equal(co2.calculationStatus, 'approved');
    assert.equal(co2.factorRelease.version, 'cag-surface-access-co2-v1');
    assert.equal(co2.estimates[0].estimate.kind, 'estimated_co2');
    assert.equal(co2.estimates[0].estimate.gas, 'CO2');
    assert.equal(co2.estimates[0].estimate.unit, 'kgCO2');
    assert.equal(co2.recommendation.kind, 'recommended_co2');
    assert.equal(
      projectPlanDisplay(co2).recommendation.kind,
      'recommended_co2',
    );
    const balances = await pool.query(
      'SELECT balance FROM app.profiles WHERE principal_id = ANY($1::uuid[])',
      [[a.id, b.id]],
    );
    assert.equal(balances.rows.length, 4);
    assert.ok(balances.rows.every((row) => row.balance === 0));
  } finally {
    await close(api);
    await close(upstream);
    await pool.query('DELETE FROM app.principals WHERE issuer=$1', [issuer]);
    await pool.end();
  }
});
