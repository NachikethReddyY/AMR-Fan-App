import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createRouteProvider } from './provider.ts';

// R30-2's accepted maximum query. Keep the complete shape, including repeated
// traversals; responsiveness must not come from discarding provider geometry.
const points = Array.from({ length: 2048 }, (_, i) =>
  i % 2
    ? { latitude: 1.34, longitude: 103.85 }
    : { latitude: 1.29, longitude: 103.8 },
);
let encoded = '';
const previous = [0, 0];
for (const point of points) {
  for (const [index, coordinate] of [
    point.latitude,
    point.longitude,
  ].entries()) {
    const next = Math.round(coordinate * 1e5);
    const delta = next - previous[index];
    previous[index] = next;
    let value = delta < 0 ? -delta * 2 - 1 : delta * 2;
    while (value >= 32) {
      encoded += String.fromCharCode((value % 32) + 95);
      value = Math.floor(value / 32);
    }
    encoded += String.fromCharCode(value + 63);
  }
}
const modes = ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'];
const bodies = new Map(
  modes.map((mode) => [
    mode,
    JSON.stringify({
      routes: Array.from({ length: 3 }, () => ({
        distanceMeters: 20_000_000,
        duration: '604800s',
        polyline: { encodedPolyline: encoded },
        legs: [
          {
            startLocation: { latLng: points[0] },
            endLocation: { latLng: points.at(-1) },
            steps: Array.from({ length: 128 }, () => ({
              travelMode: mode,
              distanceMeters: 156250,
              staticDuration: '4725s',
              ...(mode === 'TRANSIT'
                ? {
                    transitDetails: {
                      transitLine: { vehicle: { type: 'SUBWAY' } },
                    },
                  }
                : {}),
            })),
          },
        ],
      })),
    }),
  ]),
);

test('maximum accepted four-mode query preserves all geometry while servicing a 10ms heartbeat', async () => {
  assert.deepEqual(
    [...bodies.values()].map((body) => Buffer.byteLength(body)),
    [65220, 90180, 64836, 65988],
  );
  let calls = 0;
  const upstream = createServer(async (req, res) => {
    calls++;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const { travelMode } = JSON.parse(Buffer.concat(chunks).toString());
    res.setHeader('Content-Type', 'application/json');
    res.end(bodies.get(travelMode));
  });
  let lastBeat = performance.now();
  const delays: number[] = [];
  const heartbeat = setInterval(() => {
    const now = performance.now();
    delays.push(now - lastBeat - 10);
    lastBeat = now;
  }, 10);
  try {
    upstream.listen(0, '127.0.0.1');
    await once(upstream, 'listening');
    const address = upstream.address();
    assert.ok(address && typeof address === 'object');
    const env = {
      NODE_ENV: 'test',
      AMR_ROUTES_SYNTHETIC: 'true',
      AMR_GOOGLE_ROUTES_ENDPOINT: `http://127.0.0.1:${address.port}/directions/v2:computeRoutes`,
      AMR_ROUTES_TIMEOUT_MS: '5000',
    };
    const result = await createRouteProvider(env).search({
      origin: points[0],
      destination: points.at(-1),
      modes,
      extraMinutes: 1440,
    });
    await delay(25);
    assert.equal(calls, 4);
    assert.equal(result.kind, 'routes');
    if (result.kind !== 'routes') return;
    assert.equal(result.routes.length, 12);
    assert.equal(result.source.kind, 'fixture');
    for (const [index, evidence] of result.evidence.entries()) {
      assert.equal(evidence.routeId, result.routes[index].id);
      assert.equal(evidence.factorApplicability, 'singapore_indicative');
      assert.equal(evidence.geometry.kind, 'provider');
      if (evidence.geometry.kind !== 'provider') continue;
      assert.equal(evidence.geometry.points.length, 2048);
      for (const [i, point] of evidence.geometry.points.entries()) {
        assert.ok(Math.abs(point.latitude - points[i].latitude) < 1e-8);
        assert.ok(Math.abs(point.longitude - points[i].longitude) < 1e-8);
      }
    }
    // Newly agreed local regression target, not a production latency SLA.
    assert.ok(delays.length > 0);
    const maximum = Math.max(...delays);
    assert.ok(maximum <= 50, `Maximum heartbeat delay: ${maximum}ms`);

    // A separate one-mode request expires during CPU work, after its body has
    // arrived. The provider must await normalization before releasing its slot.
    const timed = createRouteProvider({
      ...env,
      AMR_ROUTES_TIMEOUT_MS: '25',
    });
    const query = {
      origin: points[0],
      destination: points.at(-1),
      modes: ['DRIVE'],
      extraMinutes: 1440,
    };
    const pending = timed.search(query);
    assert.deepEqual(await timed.search(query), {
      kind: 'unavailable',
      reason: 'busy',
    });
    assert.deepEqual(await pending, {
      kind: 'unavailable',
      reason: 'provider_error',
      outcomes: [{ mode: 'DRIVE', kind: 'unavailable', reason: 'timeout' }],
    });
    assert.equal(calls, 5);
  } finally {
    clearInterval(heartbeat);
    upstream.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      upstream.close((error) => (error ? reject(error) : resolve())),
    );
    assert.equal(upstream.listening, false);
  }
});
