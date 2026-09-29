import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { namespaceFor } from '../../../scripts/local-db.mjs';
import { test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';
import { fork, type ChildProcess } from 'node:child_process';
import { createJourneyService } from './store.ts';
import { routeFixture } from './fixtures.ts';
import { planSchema, type JourneyPlan } from './planning.ts';
import { journeyListSchema, summarySchema } from './contracts.ts';

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

test('HTTP prepare persists owner-bound candidates from the actual route provider once; Start never trusts client geometry', async (t) => {
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
  const processReceipts: {
    pid: number | undefined;
    port: number;
    exitCode?: number | null;
  }[] = [];
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
    processReceipts.push({ pid: api.pid, port: message.port });
  }
  async function stop() {
    if (api && api.exitCode === null) {
      const exited = once(api, 'exit');
      api.send({ stop: true });
      await exited;
      const receipt = processReceipts.find((item) => item.pid === api?.pid);
      if (receipt) receipt.exitCode = api.exitCode;
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
    assert.ok(plan.display, 'same-preparation comparison display is returned');
    assert.equal(plan.display.version, 1);
    assert.deepEqual(
      plan.display.routes.map((route) => route.routeId),
      ['google-car-0', 'google-walk-0'],
    );
    assert.equal(plan.display.routes[1].durationSeconds, 60);
    assert.equal(plan.display.routes[1].estimate.kind, 'estimated');
    assert.equal(plan.display.recommendation.kind, 'recommended');
    if (plan.display.recommendation.kind === 'recommended') {
      assert.equal(plan.display.recommendation.routeId, 'google-walk-0');
      assert.equal(
        plan.display.recommendation.avoidedKgCo2e,
        0.18904000000000004,
      );
    }
    assert.doesNotMatch(
      JSON.stringify(plan),
      /latitude|longitude|encodedPolyline|Fixture origin|Fixture end|description/,
    );
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
    geometry = 'absent'; // A changed upstream must not change the selected prepared route.
    const started = await post(path, start);
    assert.equal(started.status, 200);
    const active = summarySchema.parse(await started.json());
    assert.equal(active.state, 'active');
    assert.equal(active.id, selected.journey.id);
    assert.deepEqual(active.selectedLegs, plan.display.routes[1].legs);
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

    const another = plan.candidates.find(
      (candidate) => candidate.routeId === 'google-car-0',
    );
    assert.ok(another && another.kind === 'prepared');
    assert.equal(
      (
        await post(`/v1/journeys/${another.journey.id}/start`, {
          requestId: randomUUID(),
          captureSessionId: randomUUID(),
        })
      ).status,
      200,
    );
    await stop();
    await boot();
    // Restart recovery supplies only session/profile to the actual collection GET.
    const discoveryHttp = await fetch(
      `${base}/v1/profiles/${profileId}/journeys?state=active`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(
      discoveryHttp.status,
      200,
      'Registered collection restores journeys',
    );
    const discovered = journeyListSchema.parse(await discoveryHttp.json());
    assert.deepEqual(
      discovered.items.map((item) => item.id).sort(),
      [active.id, another.journey.id].sort(),
    );
    assert.equal(discoveryHttp.headers.get('cache-control'), 'no-store');
    const collection = (
      query = '',
      auth: string | null = token,
      target = profileId,
    ) =>
      fetch(`${base}/v1/profiles/${target}/journeys${query}`, {
        headers: auth === null ? {} : { Authorization: `Bearer ${auth}` },
      });
    const savedBeforeList = (
      await pool.query(
        'SELECT id, summary, snapshot, precise_expires_at FROM app.journeys WHERE profile_id=$1 ORDER BY id',
        [profileId],
      )
    ).rows;
    const firstPage = journeyListSchema.parse(
      await (await collection('?state=active&limit=1')).json(),
    );
    assert.ok(firstPage.nextCursor);
    const secondPage = journeyListSchema.parse(
      await (
        await collection(`?state=active&limit=1&before=${firstPage.nextCursor}`)
      ).json(),
    );
    assert.equal(secondPage.nextCursor, null);
    assert.deepEqual(
      [...firstPage.items, ...secondPage.items].map((item) => item.id),
      discovered.items.map((item) => item.id),
    );
    assert.equal((await collection('', null)).status, 401);
    assert.equal((await collection('', 'invalid')).status, 401);
    assert.equal((await collection('', foreign)).status, 404);
    await pool.query("UPDATE app.principals SET role='admin' WHERE id=$1", [
      b.id,
    ]);
    assert.equal(
      (await collection('', foreign)).status,
      404,
      'foreign admin is not owner',
    );
    assert.equal((await collection('', token, randomUUID())).status, 404);
    const demoProfile = a.profiles.find((p) => p.kind === 'demo');
    assert.ok(demoProfile);
    assert.deepEqual(
      journeyListSchema.parse(
        await (await collection('', token, demoProfile.id)).json(),
      ).items,
      [],
    );
    for (const query of [
      '?limit=0',
      '?limit=51',
      '?limit=1.5',
      '?limit=01',
      '?state=finished',
      '?owner=x',
      '?before=bad',
      '?limit=1&limit=2',
      '?state=active&state=active',
      `?before=${firstPage.nextCursor}`,
      `?state=active&before=${'a'.repeat(513)}`,
    ])
      assert.equal((await collection(query)).status, 400, query);
    assert.equal(
      (
        await collection(
          `?state=active&before=${firstPage.nextCursor}`,
          token,
          demoProfile.id,
        )
      ).status,
      400,
    );
    assert.equal((await collection('?limit=50')).status, 200);
    assert.equal(
      (
        await fetch(`${base}/v1/profiles/${profileId}/journeys`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: 'https://untrusted.example.test',
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (await post(`/v1/profiles/${profileId}/journeys`, {})).status,
      404,
    );
    assert.deepEqual(
      (
        await pool.query(
          'SELECT id, summary, snapshot, precise_expires_at FROM app.journeys WHERE profile_id=$1 ORDER BY id',
          [profileId],
        )
      ).rows,
      savedBeforeList,
    );
    const restoredWalk = discovered.items.find((item) => item.mode === 'walk');
    assert.ok(restoredWalk);
    assert.deepEqual(
      await (
        await fetch(`${base}/v1/journeys/${restoredWalk.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).json(),
      active,
    );
    assert.equal(calls, 2);
    t.diagnostic(
      JSON.stringify({
        registrationStatus: discoveryHttp.status,
        discoveredThroughHttpAfterRestart: discovered.items.length,
        providerCallsAfterRestart: calls,
        displayBytes: Buffer.byteLength(JSON.stringify(plan.display)),
      }),
    );
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
    assert.equal((await collection()).status, 401);
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
    assert.ok(noGeometry.display);
    assert.equal(noGeometry.display.routes.length, 2);
    assert.ok(
      noGeometry.display.routes.every(
        (route) => route.availability.kind === 'available',
      ),
    );
    assert.ok(
      noGeometry.display.routes.every(
        (route) => route.estimate.kind === 'unavailable',
      ),
    );
    assert.deepEqual(noGeometry.display.recommendation, {
      kind: 'unavailable',
      reason: 'factor_applicability_unverified',
    });
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
    assert.equal(malformed.display?.source, null);
    assert.equal(malformed.display?.fetchedAt, null);
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
    t.diagnostic(
      JSON.stringify({
        processes: processReceipts,
        upstreamBase,
        apiPid: api?.pid,
        apiExitCode: api?.exitCode,
        upstreamListening: upstream.listening,
        poolEnded: true,
        providerCalls: calls,
      }),
    );
  }
});

test('R34-1: provider-prepared closed WALK loop finishes through registered HTTP without false reversal', async (t) => {
  const points = [
    { latitude: 1.29, longitude: 103.85 },
    { latitude: 1.295, longitude: 103.85 },
    { latitude: 1.295, longitude: 103.855 },
    { latitude: 1.29, longitude: 103.855 },
    { latitude: 1.29, longitude: 103.85 },
  ];
  const { createApi } = await import('../api/app.ts');
  const pool = createDatabase();
  const issuer = `urn:amr:r34-loop:${randomUUID()}`;
  let api: Server | undefined;
  let providerCalls = 0;
  const upstream = createServer(async (req, res) => {
    providerCalls++;
    const chunks: Buffer[] = [];
    for await (const part of req) chunks.push(Buffer.from(part));
    const query = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(query.travelMode, 'WALK');
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        routes: [
          {
            distanceMeters: 2224,
            duration: '240s',
            polyline: { encodedPolyline: 'o}zFoezxRg^??g^f^??f^' },
            legs: [
              {
                startLocation: { latLng: points[0] },
                endLocation: { latLng: points[4] },
                steps: [
                  {
                    travelMode: 'WALK',
                    distanceMeters: 2224,
                    staticDuration: '240s',
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
  });
  try {
    await migrate(pool);
    const account = await ensureAccount(pool, { issuer, subject: 'loop' });
    const profile = account.profiles.find((p) => p.kind === 'real');
    assert.ok(profile);
    const token = (await createSession(pool, account.id)).token;
    const upstreamBase = await listen(upstream);
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
    api = createApi({
      pool,
      env: {
        NODE_ENV: 'test',
        API_HOST: '127.0.0.1',
        AUTH_DEV_ENABLED: 'true',
        JOURNEY_FIXTURES_ENABLED: 'true',
        AMR_ROUTES_SYNTHETIC: 'true',
        AMR_GOOGLE_ROUTES_ENDPOINT: `${upstreamBase}/directions/v2:computeRoutes`,
      },
    });
    const base = await listen(api);
    const post = async (path: string, body: unknown) => {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      assert.ok(response.ok, `HTTP ${response.status}`);
      return response.json();
    };
    const plan = planSchema.parse(
      await post('/v1/journeys/prepare', {
        profileId: profile.id,
        requestId: randomUUID(),
        query: {
          origin: points[0],
          destination: points[4],
          modes: ['WALK'],
          extraMinutes: 0,
        },
      }),
    );
    assert.equal(plan.kind, 'prepared');
    assert.ok(
      plan.kind === 'prepared' && plan.candidates[0].kind === 'prepared',
    );
    const journeyId = plan.candidates[0].journey.id;
    const captureSessionId = randomUUID();
    const active = summarySchema.parse(
      await post(`/v1/journeys/${journeyId}/start`, {
        requestId: randomUUID(),
        captureSessionId,
      }),
    );
    assert.ok(active.startedAtMs !== null);
    const startTime = active.startedAtMs;
    t.mock.timers.tick(240000);
    await post(`/v1/journeys/${journeyId}/evidence`, {
      requestId: randomUUID(),
      captureSessionId,
      samples: points.map((point, index) => ({
        ...point,
        id: randomUUID(),
        acquiredAtMs: startTime + index * 60000,
        receivedAtMs: Date.now(),
        accuracyMeters: 2,
        mocked: false,
        context: 'foreground',
      })),
    });
    const finished = summarySchema.parse(
      await post(`/v1/journeys/${journeyId}/finish`, {
        requestId: randomUUID(),
        captureSessionId,
        endedAtMs: Date.now(),
        reason: 'arrival',
      }),
    );
    const fetched = await fetch(`${base}/v1/journeys/${journeyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(fetched.status, 200);
    const persisted = summarySchema.parse(await fetched.json());
    assert.deepEqual(persisted.assessment, finished.assessment);
    t.diagnostic(
      JSON.stringify({ providerCalls, assessment: persisted.assessment }),
    );
    assert.equal(providerCalls, 1);
    assert.equal(persisted.assessment.startRecorded, true);
    assert.equal(persisted.assessment.arrivalRecorded, true);
    assert.equal(persisted.assessment.status, 'satisfies_configured_rules');
    assert.deepEqual(persisted.assessment.reasons, []);
    assert.equal(persisted.assessment.calibration, 'unvalidated');
  } finally {
    if (api?.listening) await close(api);
    if (upstream.listening) await close(upstream);
    t.mock.timers.reset();
    await pool.query('DELETE FROM app.principals WHERE issuer=$1', [issuer]);
    await pool.end();
    t.diagnostic(
      JSON.stringify({
        apiListening: api?.listening ?? false,
        upstreamListening: upstream.listening,
        poolEnded: true,
      }),
    );
  }
});

test('registered collection uses current read authority after lock waits and never cleans expired precision', async (t) => {
  const { createApi } = await import('../api/app.ts');
  const pool = createDatabase();
  const issuer = `urn:amr:journey-collection:${randomUUID()}`;
  const api = createApi({
    pool,
    env: { NODE_ENV: 'test', API_HOST: '127.0.0.1', AUTH_DEV_ENABLED: 'true' },
  });
  let base = '';
  try {
    await migrate(pool);
    const account = await ensureAccount(pool, { issuer, subject: 'owner' });
    const profile = account.profiles.find((item) => item.kind === 'real');
    assert.ok(profile);
    const token = (await createSession(pool, account.id)).token;
    const oldTime = Date.now() - 8 * 86400000;
    const fixtureService = createJourneyService({
      pool,
      env: { NODE_ENV: 'test', JOURNEY_FIXTURES_ENABLED: 'true' },
      clock: () => oldTime,
    });
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const prepared = await fixtureService.prepare(
        token,
        { profileId: profile.id, requestId: randomUUID() },
        routeFixture(oldTime),
      );
      await fixtureService.start(token, prepared.id, {
        requestId: randomUUID(),
        captureSessionId: randomUUID(),
      });
      ids.push(prepared.id);
    }
    const before = (
      await pool.query(
        'SELECT id,summary,snapshot,precise_expires_at FROM app.journeys WHERE profile_id=$1 ORDER BY id',
        [profile.id],
      )
    ).rows;
    const receiptsBefore = (
      await pool.query(
        'SELECT request_id,result FROM app.journey_requests WHERE principal_id=$1 ORDER BY request_id',
        [account.id],
      )
    ).rows;
    base = await listen(api);
    const get = (auth = token, query = '?state=active&limit=1') =>
      fetch(`${base}/v1/profiles/${profile.id}/journeys${query}`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
    const first = await get();
    assert.equal(first.status, 200);
    const page = journeyListSchema.parse(await first.json());
    assert.ok(page.nextCursor);
    const next = journeyListSchema.parse(
      await (
        await get(token, `?state=active&limit=1&before=${page.nextCursor}`)
      ).json(),
    );
    assert.deepEqual(
      [...page.items, ...next.items].map((item) => item.id),
      ids.sort().reverse(),
    );
    assert.ok(page.items[0].preciseExpiresAtMs < page.asOfMs);
    assert.deepEqual(
      (
        await pool.query(
          'SELECT id,summary,snapshot,precise_expires_at FROM app.journeys WHERE profile_id=$1 ORDER BY id',
          [profile.id],
        )
      ).rows,
      before,
    );
    assert.deepEqual(
      (
        await pool.query(
          'SELECT request_id,result FROM app.journey_requests WHERE principal_id=$1 ORDER BY request_id',
          [account.id],
        )
      ).rows,
      receiptsBefore,
    );
    for (const target of ['session', 'profile']) {
      const short = (await createSession(pool, account.id)).token;
      const hash = createHash('sha256').update(short).digest('hex');
      const lock = await pool.connect();
      let pending: Promise<Response> | undefined;
      try {
        await pool.query(
          "UPDATE app.sessions SET expires_at=clock_timestamp()+interval '1 second' WHERE token_hash=$1",
          [hash],
        );
        await lock.query('BEGIN');
        const blocker = await lock.query<{ pid: number }>(
          'SELECT pg_backend_pid() AS pid',
        );
        if (target === 'session')
          await lock.query(
            'SELECT token_hash FROM app.sessions WHERE token_hash=$1 FOR UPDATE',
            [hash],
          );
        else
          await lock.query(
            'SELECT id FROM app.profiles WHERE id=$1 FOR UPDATE',
            [profile.id],
          );
        pending = get(short);
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          if (
            (
              await pool.query(
                'SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))',
                [blocker.rows[0].pid],
              )
            ).rowCount
          ) {
            waiting = true;
            break;
          }
          await pool.query('SELECT pg_sleep(0.01)');
        }
        assert.ok(waiting, `actual GET waits on ${target} lock`);
        await lock.query(
          'SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM (expires_at-clock_timestamp())))+0.05) FROM app.sessions WHERE token_hash=$1',
          [hash],
        );
        await lock.query('COMMIT');
        assert.equal((await pending).status, 401);
        assert.equal((await get(short)).status, 401);
      } finally {
        await lock.query('ROLLBACK');
        lock.release();
        await pending;
      }
    }
    assert.deepEqual(
      (
        await pool.query(
          'SELECT id,summary,snapshot,precise_expires_at FROM app.journeys WHERE profile_id=$1 ORDER BY id',
          [profile.id],
        )
      ).rows,
      before,
    );
  } finally {
    if (api.listening) await close(api);
    await pool.query('DELETE FROM app.principals WHERE issuer=$1', [issuer]);
    await pool.end();
    t.diagnostic(
      JSON.stringify({ base, apiListening: api.listening, poolEnded: true }),
    );
  }
});
