import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRouteProvider } from './provider.ts';

const env = { AMR_GOOGLE_ROUTES_KEY: 'synthetic-never-dispatched-key' };
const input = {
  origin: 'Singapore',
  destination: 'Botanic Gardens',
  modes: ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'],
  extraMinutes: 10,
};

test('configured Google without durable admission never dispatches', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ routes: [] }),
  );
  assert.deepEqual(await createRouteProvider(env).search(input), {
    kind: 'unavailable',
    reason: 'live_not_configured',
  });
  assert.equal(fetch.mock.callCount(), 0);
});

test('all modes reserve before any dispatch; denied or uncertain reservations dispatch nothing', async (t) => {
  const events: string[] = [];
  t.mock.method(globalThis, 'fetch', async () => {
    events.push('fetch');
    return Response.json({ routes: [] });
  });
  const provider = createRouteProvider(env, {
    async reserve(attempts: number) {
      events.push(`reserve:${attempts}`);
      return true;
    },
  });
  await provider.search(input);
  assert.deepEqual(events, ['reserve:4', 'fetch', 'fetch', 'fetch', 'fetch']);
  for (const reserve of [
    async () => false,
    async () => {
      throw new Error('uncertain private database result');
    },
  ]) {
    events.length = 0;
    const denied = await createRouteProvider(env, { reserve }).search(input);
    assert.equal(denied.kind, 'unavailable');
    assert.deepEqual(events, []);
    assert.ok(!JSON.stringify(denied).includes('private'));
  }
});

test('reservation wait is bounded and late success cannot dispatch', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({}),
  );
  const reservation = Promise.withResolvers<boolean>();
  const provider = createRouteProvider(
    { ...env, AMR_ROUTES_TIMEOUT_MS: '25' },
    {
      reserve: () => reservation.promise,
    },
  );
  const started = performance.now();
  const result = await provider.search(input);
  assert.deepEqual(result, { kind: 'unavailable', reason: 'timeout' });
  assert.ok(performance.now() - started < 500);
  reservation.resolve(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetch.mock.callCount(), 0);
});

test('invalid input and local busy rejection cannot reserve', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  const reservation = Promise.withResolvers<boolean>();
  let count = 0;
  const provider = createRouteProvider(env, {
    reserve: () => {
      count++;
      return reservation.promise;
    },
  });
  await provider.search({ ...input, modes: ['TWO_WHEELER'] });
  assert.equal(count, 0);
  const first = provider.search(input);
  assert.deepEqual(await provider.search(input), {
    kind: 'unavailable',
    reason: 'busy',
  });
  assert.equal(count, 1);
  reservation.resolve(true);
  await first;
});

test('all four request shapes remain Essentials with ordinary step geometry', async (t) => {
  const modes: string[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      assert.equal(
        url,
        'https://routes.googleapis.com/directions/v2:computeRoutes',
      );
      assert.equal(init?.redirect, 'error');
      assert.equal(typeof init?.body, 'string');
      const body = JSON.parse(String(init?.body));
      modes.push(body.travelMode);
      assert.deepEqual(body, {
        origin: { address: input.origin },
        destination: { address: input.destination },
        travelMode: body.travelMode,
        computeAlternativeRoutes: false,
        regionCode: 'SG',
        units: 'METRIC',
        polylineQuality: 'HIGH_QUALITY',
        ...(body.travelMode === 'DRIVE'
          ? { routingPreference: 'TRAFFIC_UNAWARE' }
          : {}),
      });
      assert.equal(
        new Headers(init?.headers).get('X-Goog-FieldMask'),
        [
          'routes.distanceMeters',
          'routes.duration',
          'routes.legs.steps.distanceMeters',
          'routes.legs.steps.polyline.encodedPolyline',
          'routes.legs.steps.staticDuration',
          'routes.legs.steps.travelMode',
          'routes.legs.steps.transitDetails.transitLine.vehicle.type',
          'routes.polyline.encodedPolyline',
          'routes.legs.startLocation',
          'routes.legs.endLocation',
        ].join(','),
      );
      return Response.json({ routes: [] });
    },
  );
  await createRouteProvider(env, { reserve: async () => true }).search(input);
  assert.deepEqual(modes, input.modes);
});

test('failed calls and repeated searches consume new reservations with no retry or refund', async (t) => {
  let used = 0;
  const budget = {
    async reserve(n: number) {
      used += n;
      return true;
    },
  };
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('synthetic network failure');
  });
  for (let i = 0; i < 2; i++)
    await createRouteProvider(env, budget).search(input);
  assert.equal(used, 8);
  assert.equal(fetch.mock.callCount(), 8);
});

test('timeout after reservation burns all modes without dispatching late second batch', async (t) => {
  let used = 0;
  const mockedFetch = t.mock.method(
    globalThis,
    'fetch',
    async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const signal = init?.signal;
      assert.ok(signal);
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new Error('synthetic timeout')),
          { once: true },
        );
      });
    },
  );
  const provider = createRouteProvider(
    { ...env, AMR_ROUTES_TIMEOUT_MS: '25' },
    {
      async reserve(n) {
        used += n;
        return true;
      },
    },
  );
  assert.equal((await provider.search(input)).kind, 'unavailable');
  assert.equal(used, 4);
  assert.equal(mockedFetch.mock.callCount(), 2);
});
