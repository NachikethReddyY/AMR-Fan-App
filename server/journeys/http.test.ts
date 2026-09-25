import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { namespaceFor } from '../../scripts/local-db.mjs';
import { test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';
import { fork, type ChildProcess } from 'node:child_process';
import { createJourneyService } from './store.ts';
import { planSchema, type JourneyPlan } from './planning.ts';
import { summarySchema } from './contracts.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${namespaceFor(fileURLToPath(new URL('../../', import.meta.url)))}_test`
)
  throw new Error('Use only the allocated journey worktree test database.');
async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

test('HTTP prepare persists owner-bound candidates from the actual route provider once; Start never trusts client geometry', async () => {
  const pool = createDatabase();
  const issuer = `urn:amr:journey-http:${randomUUID()}`;
  let calls = 0;
  const providerQueries: unknown[] = [];
  let geometry: 'valid' | 'absent' | 'malformed' = 'valid';
  const upstream = createServer(async (req, res) => {
    calls++;
    const chunks: Buffer[] = [];
    for await (const part of req) chunks.push(Buffer.from(part));
    const input = JSON.parse(Buffer.concat(chunks).toString());
    providerQueries.push(input);
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        routes: [
          {
            distanceMeters: 1112,
            duration: '60s',
            ...(geometry === 'absent'
              ? {}
              : {
                  polyline: {
                    encodedPolyline:
                      geometry === 'valid' ? 'o}zFoezxRo}@?' : 'INVALID!',
                  },
                }),
            legs: [
              {
                startLocation: {
                  latLng: { latitude: 1.29, longitude: 103.85 },
                },
                endLocation: { latLng: { latitude: 1.3, longitude: 103.85 } },
                steps: [
                  {
                    travelMode: input.travelMode,
                    distanceMeters: 1112,
                    staticDuration: '60s',
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
  });
  const upstreamBase = await listen(upstream);
  let api: ChildProcess | undefined;
  let base = '';
  async function boot() {
    api = fork(
      fileURLToPath(new URL('./testing/api-process.ts', import.meta.url)),
      [],
      {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          API_HOST: '127.0.0.1',
          AUTH_DEV_ENABLED: 'true',
          JOURNEY_FIXTURES_ENABLED: 'true',
          AMR_ROUTES_SYNTHETIC: 'true',
          AMR_GOOGLE_ROUTES_ENDPOINT: `${upstreamBase}/directions/v2:computeRoutes`,
        },
        stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      },
    );
    const ready = await Promise.race([
      once(api, 'message'),
      once(api, 'exit').then(() => {
        throw new Error('API process exited before listening.');
      }),
    ]);
    const message: unknown = ready[0];
    assert.ok(
      message &&
        typeof message === 'object' &&
        'port' in message &&
        typeof message.port === 'number',
    );
    base = `http://127.0.0.1:${message.port}`;
  }
  async function stop() {
    if (api && api.exitCode === null) {
      const exited = once(api, 'exit');
      api.send({ stop: true });
      await exited;
    }
  }
  try {
    await migrate(pool);
    await boot();
    const a = await ensureAccount(pool, { issuer, subject: 'a' });
    const b = await ensureAccount(pool, { issuer, subject: 'b' });
    const token = (await createSession(pool, a.id)).token;
    const foreign = (await createSession(pool, b.id)).token;
    const realProfile = a.profiles.find((p) => p.kind === 'real');
    assert.ok(realProfile);
    const profileId = realProfile.id;
    const post = (path: string, body: unknown, auth = token) =>
      fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    const input = {
      profileId,
      requestId: randomUUID(),
      query: {
        origin: 'Fixture origin',
        destination: 'Fixture end',
        modes: ['DRIVE', 'WALK'],
        extraMinutes: 10,
      },
    };
    assert.equal(
      (await post('/v1/journeys/prepare', input, foreign)).status,
      404,
    );
    assert.equal(calls, 0);
    const [first, concurrentPlan] = await Promise.all([
      post('/v1/journeys/prepare', input),
      post('/v1/journeys/prepare', input),
    ]);
    assert.equal(first.status, 201);
    const plan: JourneyPlan = planSchema.parse(await first.json());
    assert.equal(plan.kind, 'prepared');
    if (plan.kind !== 'prepared') assert.fail('Expected supported routes.');
    assert.equal(plan.kind, 'prepared');
    assert.equal(plan.candidates.length, 2);
    assert.deepEqual(await concurrentPlan.json(), plan);
    assert.equal(calls, 2);
    assert.deepEqual(
      await (await post('/v1/journeys/prepare', input)).json(),
      plan,
    );
    assert.equal(calls, 2);
    const selected = plan.candidates.find(
      (candidate: { routeId: string }) => candidate.routeId === 'google-walk-0',
    );
    assert.ok(selected && selected.kind === 'prepared');
    assert.equal(selected.journey.source.kind, 'fixture');
    assert.deepEqual(
      providerQueries.map((raw) => {
        assert.ok(
          raw &&
            typeof raw === 'object' &&
            'origin' in raw &&
            'destination' in raw,
        );
        return [raw.origin, raw.destination];
      }),
      [
        [{ address: 'Fixture origin' }, { address: 'Fixture end' }],
        [{ address: 'Fixture origin' }, { address: 'Fixture end' }],
      ],
    );
    const saved = await pool.query(
      'SELECT snapshot FROM app.journeys WHERE id=$1',
      [selected.journey.id],
    );
    assert.deepEqual(saved.rows[0].snapshot.query, input.query);
    assert.equal(saved.rows[0].snapshot.routeId, 'google-walk-0');
    assert.deepEqual(saved.rows[0].snapshot.start, {
      latitude: 1.29,
      longitude: 103.85,
    });
    assert.deepEqual(saved.rows[0].snapshot.end, {
      latitude: 1.3,
      longitude: 103.85,
    });

    assert.equal(selected.journey.routeEvidence.primaryMode, 'WALK');
    assert.equal(
      selected.journey.routeEvidence.factorApplicability,
      'singapore_indicative',
    );
    assert.equal(selected.journey.basis.calculation.kind, 'available');
    const path = `/v1/journeys/${selected.journey.id}/start`;
    const start = { requestId: randomUUID(), captureSessionId: randomUUID() };
    assert.equal((await post(path, start, foreign)).status, 404);
    assert.equal((await post(path, { ...start, geometry: [] })).status, 400);
    const started = await post(path, start);
    assert.equal(started.status, 200);
    const active = summarySchema.parse(await started.json());
    assert.equal(active.state, 'active');
    assert.equal(calls, 2);
    assert.equal(
      (
        await post('/v1/journeys/prepare', {
          ...input,
          query: { ...input.query, extraMinutes: 11 },
        })
      ).status,
      409,
    );

    await stop();
    await boot();
    const get = (suffix = '', auth = token) =>
      fetch(`${base}/v1/journeys/${active.id}${suffix}`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
    assert.deepEqual(await (await get()).json(), active);
    assert.deepEqual(
      await (await post('/v1/journeys/prepare', input)).json(),
      plan,
    );
    assert.equal(calls, 2, 'restart replay does not query provider');
    assert.equal((await get('', foreign)).status, 404);
    assert.equal((await get('', 'invalid')).status, 401);
    assert.deepEqual(await (await post(path, start)).json(), active);
    assert.ok(active.startedAtMs !== null);
    await pool.query('SELECT pg_sleep(0.02)');
    const endedAtMs = Date.now();
    const startedAtMs = active.startedAtMs;
    const samples = [1.29, 1.295, 1.3].map((latitude, index) => ({
      id: randomUUID(),
      latitude,
      longitude: 103.85,
      accuracyMeters: 1,
      acquiredAtMs:
        startedAtMs + Math.floor((index * (endedAtMs - startedAtMs)) / 2),
      receivedAtMs: endedAtMs,
      context: 'foreground',
      mocked: false,
    }));
    const evidencePath = `/v1/journeys/${active.id}/evidence`;
    const batch = {
      requestId: randomUUID(),
      captureSessionId: start.captureSessionId,
      samples: [samples[0], samples[2]],
    };
    const finish = {
      requestId: randomUUID(),
      captureSessionId: start.captureSessionId,
      endedAtMs,
      reason: 'arrival',
    };
    const [batchResponse, finishResponse] = await Promise.all([
      post(evidencePath, batch),
      post(`/v1/journeys/${active.id}/finish`, finish),
    ]);
    assert.equal(batchResponse.status, 200);
    assert.equal(finishResponse.status, 200);
    const savedBatch = await batchResponse.json();
    assert.deepEqual(
      await (await post(evidencePath, batch)).json(),
      savedBatch,
    );
    const late = { ...batch, requestId: randomUUID(), samples: [samples[1]] };
    const concurrent = await Promise.all([
      post(evidencePath, late),
      post(evidencePath, { ...late, requestId: randomUUID() }),
    ]);
    assert.ok(concurrent.every((response) => response.status === 200));
    const finished = summarySchema.parse(await (await get()).json());
    assert.equal(finished.assessment.status, 'satisfies_configured_rules');
    assert.equal(finished.assessment.sampleCount, 3);
    assert.equal(finished.assessment.calibration, 'unvalidated');
    assert.deepEqual(
      await (await get('/assessment')).json(),
      finished.assessment,
    );
    assert.equal(
      (
        await post(evidencePath, {
          ...late,
          requestId: randomUUID(),
          samples: [{ ...samples[1], latitude: 0 }],
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await post(evidencePath, {
          ...late,
          requestId: randomUUID(),
          samples: Array.from({ length: 101 }, () => samples[1]),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post(evidencePath, {
          ...late,
          requestId: randomUUID(),
          samples: Array.from({ length: 100 }, () => samples[1]),
        })
      ).status,
      200,
    );
    assert.equal(
      (await post(evidencePath, { padding: 'x'.repeat(33000) })).status,
      413,
    );
    assert.equal(
      (
        await post(evidencePath, {
          ...late,
          requestId: randomUUID(),
          samples: [
            { ...samples[1], id: randomUUID(), acquiredAtMs: endedAtMs + 1 },
          ],
        })
      ).status,
      409,
    );
    assert.equal((await post(evidencePath, late, foreign)).status, 404);
    const rejectedOrigin = await fetch(`${base}${evidencePath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'https://untrusted.example.test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(late),
    });
    assert.equal(rejectedOrigin.status, 403);
    // Server-only cleanup clock exercises the deadline without changing HTTP authority time.
    await createJourneyService({
      pool,
      env: { NODE_ENV: 'test' },
      clock: () => active.preciseExpiresAtMs,
    }).cleanup();
    assert.deepEqual(await (await get()).json(), finished);
    assert.deepEqual(
      await (await post('/v1/journeys/prepare', input)).json(),
      plan,
    );
    const precise = await pool.query(
      'SELECT snapshot FROM app.journeys WHERE id=$1',
      [active.id],
    );
    assert.equal(precise.rows[0].snapshot, null);
    await stop();
    await boot();
    assert.deepEqual(await (await get()).json(), finished);
    assert.equal(
      (
        await fetch(`${base}/v1/session`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
      200,
    );
    assert.equal((await get()).status, 401);
    assert.equal((await post(evidencePath, late)).status, 401);
    const foreignProfile = b.profiles.find((p) => p.kind === 'real');
    assert.ok(foreignProfile);
    const unavailableInput = {
      ...input,
      requestId: randomUUID(),
      profileId: foreignProfile.id,
    };
    geometry = 'absent';
    const noGeometry = planSchema.parse(
      await (
        await post('/v1/journeys/prepare', unavailableInput, foreign)
      ).json(),
    );
    assert.equal(noGeometry.kind, 'prepared');
    if (noGeometry.kind !== 'prepared')
      assert.fail('Route availability survives absent geometry.');
    assert.deepEqual(
      noGeometry.candidates.map((candidate) => candidate.kind),
      ['unavailable', 'unavailable'],
    );
    assert.ok(
      noGeometry.candidates.every(
        (candidate) =>
          candidate.kind === 'unavailable' &&
          candidate.reason === 'missing_geometry',
      ),
    );
    geometry = 'malformed';
    const malformed = planSchema.parse(
      await (
        await post(
          '/v1/journeys/prepare',
          { ...unavailableInput, requestId: randomUUID() },
          foreign,
        )
      ).json(),
    );
    assert.equal(malformed.kind, 'unavailable');
    const foreignRows = await pool.query(
      'SELECT id FROM app.journeys WHERE profile_id=$1',
      [unavailableInput.profileId],
    );
    assert.equal(foreignRows.rowCount, 0);
    const balances = await pool.query(
      'SELECT balance FROM app.profiles WHERE principal_id=ANY($1::uuid[])',
      [[a.id, b.id]],
    );
    assert.ok(balances.rows.every((row) => row.balance === 0));
  } finally {
    await stop();
    await close(upstream);
    await pool.query('DELETE FROM app.principals WHERE issuer=$1', [issuer]);
    await pool.end();
  }
});
