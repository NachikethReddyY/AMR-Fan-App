import { parseComparison } from '../../src/features/routes/api.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRouteQuery } from './query.ts';
import { ApiError } from '../accounts/types.ts';
import { createServer } from 'node:http';
import { once } from 'node:events';

const input = {
  origin: 'Singapore',
  destination: 'Botanic Gardens',
  modes: ['DRIVE'],
  extraMinutes: 10,
};
test('query requires server-authenticated actor and rejects client ownership fields', async () => {
  const query = createRouteQuery({ env: {} });
  await assert.rejects(
    query(null, input),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );
  await assert.rejects(
    query(
      { principalId: 'account-a', role: 'fan' },
      { ...input, principalId: 'account-b' },
    ),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
  const result = await query({ principalId: 'account-a', role: 'fan' }, input);
  assert.equal(parseComparison(result).calculationStatus, 'indicative_demo');
  assert.equal(result.factorRelease, undefined);
  assert.equal(result.result.kind, 'unavailable');
  assert.deepEqual(result.result, {
    kind: 'unavailable',
    reason: 'live_not_configured',
  });
});

test('authenticated query calculates only supported returned geography through real upstream HTTP', async () => {
  let calls = 0;
  let geometry: 'valid' | 'missing' | 'degenerate' = 'valid';
  const server = createServer(async (req, res) => {
    calls++;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const { travelMode } = JSON.parse(Buffer.concat(chunks).toString());
    const minutes =
      travelMode === 'DRIVE' ? 30 : travelMode === 'TRANSIT' ? 40 : 45;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        routes: [
          {
            distanceMeters: 10000,
            duration: `${minutes * 60}s`,
            ...(geometry === 'missing'
              ? {}
              : {
                  polyline: {
                    encodedPolyline:
                      geometry === 'degenerate'
                        ? 'o}zFoezxR??'
                        : 'o}zFoezxRo}@?',
                  },
                }),
            legs: [
              {
                startLocation: {
                  latLng: { latitude: 1.29, longitude: 103.85 },
                },
                endLocation: {
                  latLng: {
                    latitude: geometry === 'degenerate' ? 1.29 : 1.3,
                    longitude: 103.85,
                  },
                },
                steps: [
                  {
                    travelMode,
                    distanceMeters: 10000,
                    staticDuration: `${minutes * 60}s`,
                    ...(travelMode === 'TRANSIT'
                      ? {
                          transitDetails: {
                            transitLine: { vehicle: { type: 'SUBWAY' } },
                          },
                        }
                      : {}),
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
  });
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const query = createRouteQuery({
      env: {
        NODE_ENV: 'test',
        AMR_ROUTES_SYNTHETIC: 'true',
        AMR_GOOGLE_ROUTES_ENDPOINT: `http://127.0.0.1:${address.port}/directions/v2:computeRoutes`,
      },
    });
    await assert.rejects(query(null, input), ApiError);
    assert.equal(calls, 0);
    const result = await query(
      { principalId: 'account-a', role: 'fan' },
      { ...input, modes: ['DRIVE', 'TRANSIT', 'WALK'] },
    );
    assert.equal(calls, 3);
    assert.equal(result.result.kind, 'routes');
    assert.equal(result.recommendation.kind, 'recommended');
    if (result.recommendation.kind === 'recommended') {
      assert.equal(result.recommendation.route.mode, 'train');
      assert.equal(result.recommendation.fastestSeconds, 1800);
      assert.equal(result.recommendation.limitSeconds, 2400);
      assert.ok(Math.abs(result.recommendation.avoidedKgCo2e - 1.6) < 1e-9);
      assert.equal(result.recommendation.baselineDistanceMeters, 10000);
    }
    if (result.result.kind === 'routes') {
      assert.equal(result.result.source.kind, 'fixture');
      assert.ok(Number.isFinite(Date.parse(result.result.fetchedAt)));
      assert.deepEqual(
        result.result.evidence.map((e) => e.routeId),
        result.result.routes.map((r) => r.id),
      );
    }
    assert.equal(result.calculationStatus, 'indicative_demo');
    assert.deepEqual(result.unsupportedModes, ['cab', 'electric_car']);
    geometry = 'missing';
    const unknown = await query(
      { principalId: 'account-b', role: 'fan' },
      input,
    );
    assert.deepEqual(unknown.estimates[0].estimate, {
      kind: 'unavailable',
      reason: 'geography_unverified',
    });
    assert.deepEqual(unknown.recommendation, {
      kind: 'unavailable',
      reason: 'factor_applicability_unverified',
    });
    assert.equal(unknown.result.kind, 'routes');
    geometry = 'degenerate';
    const invalid = await query(
      { principalId: 'account-b', role: 'fan' },
      input,
    );
    assert.deepEqual(invalid.result, {
      kind: 'unavailable',
      reason: 'provider_error',
      outcomes: [
        { mode: 'DRIVE', kind: 'unavailable', reason: 'missing_data' },
      ],
    });
    assert.deepEqual(invalid.estimates, []);
    assert.deepEqual(invalid.recommendation, {
      kind: 'unavailable',
      reason: 'no_routes',
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    assert.equal(server.listening, false);
  }
});

test('bounded account window cannot be bypassed with a client owner and does not mix account queries', async () => {
  const query = createRouteQuery({ env: {} });
  for (let i = 0; i < 6; i++)
    await query({ principalId: 'account-a', role: 'fan' }, input);
  await assert.rejects(
    query({ principalId: 'account-a', role: 'fan' }, input),
    (error: unknown) => error instanceof ApiError && error.status === 429,
  );
  assert.equal(
    (await query({ principalId: 'account-b', role: 'fan' }, input)).result.kind,
    'unavailable',
  );
});
