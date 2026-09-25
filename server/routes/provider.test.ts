import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, type RequestListener } from 'node:http';
import { once } from 'node:events';
import { createRouteProvider } from './provider.ts';

const input = {
  origin: 'Marina Bay Sands, Singapore',
  destination: 'Singapore Botanic Gardens',
  modes: ['DRIVE'],
  extraMinutes: 10,
};

test('missing provider credentials remain unavailable without fallback routes', async () => {
  const provider = createRouteProvider({});
  assert.deepEqual(await provider.search(input), {
    kind: 'unavailable',
    reason: 'live_not_configured',
  });
});

test('endpoint configuration rejects redirects-to-secrets and arbitrary upstream hosts', () => {
  for (const endpoint of [
    'http://routes.googleapis.com/directions/v2:computeRoutes',
    'https://routes.googleapis.com.evil.test/directions/v2:computeRoutes',
    'https://routes.googleapis.com@evil.test/directions/v2:computeRoutes',
    'https://routes.googleapis.com/directions/v2:computeRoutes?key=secret',
    'https://routes.googleapis.com/directions/v2:computeRoutes#fragment',
    'http://127.0.0.1:1234/directions/v2:computeRoutes',
  ]) {
    assert.throws(
      () =>
        createRouteProvider({
          AMR_GOOGLE_ROUTES_KEY: 'synthetic-provider-key',
          AMR_GOOGLE_ROUTES_ENDPOINT: endpoint,
        }),
      { message: 'Invalid route provider configuration.' },
    );
  }
});

export function response(mode = 'DRIVE') {
  return {
    routes: [
      {
        distanceMeters: 10000,
        duration: '1800s',
        legs: [
          {
            steps: [
              {
                distanceMeters: 10000,
                staticDuration: '1800s',
                travelMode: mode,
                ...(mode === 'TRANSIT'
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
  };
}

async function fixture(
  handler: RequestListener,
  run: (env: Record<string, string>) => Promise<void>,
) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    await run({
      NODE_ENV: 'test',
      AMR_ROUTES_SYNTHETIC: 'true',
      AMR_GOOGLE_ROUTES_ENDPOINT: `http://127.0.0.1:${address.port}/directions/v2:computeRoutes`,
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    assert.equal(server.listening, false);
  }
}

test('real HTTP fixture receives bounded Google request and returns labelled normalized routes', async () => {
  let requests = 0;
  await fixture(
    async (req, res) => {
      requests++;
      assert.equal(req.method, 'POST');
      assert.equal(req.url, '/directions/v2:computeRoutes');
      assert.equal(req.headers['x-goog-api-key'], 'amr-synthetic-routes');
      assert.ok(!String(req.headers['x-goog-fieldmask']).includes('*'));
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString());
      assert.deepEqual(body.origin, { address: input.origin });
      assert.deepEqual(body.destination, { address: input.destination });
      assert.equal(body.travelMode, 'DRIVE');
      assert.equal(body.computeAlternativeRoutes, false);
      assert.equal(body.extraMinutes, undefined);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(response()));
    },
    async (env) => {
      const result = await createRouteProvider(env).search(input);
      assert.equal(result.kind, 'routes');
      if (result.kind !== 'routes') return;
      assert.equal(result.source.kind, 'fixture');
      assert.equal(result.routes[0].mode, 'car');
      assert.equal(result.routes[0].distanceMeters, 10000);
      assert.equal(
        result.routes.some(
          (route) => route.mode === 'cab' || route.mode === 'electric_car',
        ),
        false,
      );
      assert.ok(!JSON.stringify(result).includes('amr-synthetic-routes'));
      assert.ok(!JSON.stringify(result).includes(input.origin));
    },
  );
  assert.equal(requests, 1);
});

test('invalid inputs spend no provider requests', async () => {
  let requests = 0;
  await fixture(
    (_req, res) => {
      requests++;
      res.end('{}');
    },
    async (env) => {
      const provider = createRouteProvider(env);
      for (const invalid of [
        null,
        {},
        { ...input, origin: '' },
        { ...input, origin: 'x'.repeat(201) },
        { ...input, origin: { latitude: '1.3', longitude: 103.8 } },
        { ...input, origin: { latitude: 91, longitude: 0 } },
        { ...input, modes: [] },
        { ...input, modes: ['CAB'] },
        { ...input, modes: ['DRIVE', 'DRIVE'] },
        { ...input, extraMinutes: Infinity },
        { ...input, extraMinutes: -1 },
        { ...input, extraMinutes: 1.5 },
        { ...input, accountId: 'other-account' },
        { ...input, endpoint: 'https://evil.test' },
      ])
        assert.deepEqual(await provider.search(invalid), {
          kind: 'unavailable',
          reason: 'invalid_input',
        });
    },
  );
  assert.equal(requests, 0);
});

test('primary modes cost exactly four requests with at most two concurrent calls and no cab relabelling', async () => {
  let requests = 0,
    active = 0,
    peak = 0;
  await fixture(
    async (req, res) => {
      requests++;
      active++;
      peak = Math.max(peak, active);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const { travelMode } = JSON.parse(Buffer.concat(chunks).toString());
      await new Promise((resolve) => setTimeout(resolve, 15));
      active--;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(response(travelMode)));
    },
    async (env) => {
      const provider = createRouteProvider(env);
      const pending = provider.search({
        ...input,
        modes: ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'],
      });
      assert.deepEqual(await provider.search(input), {
        kind: 'unavailable',
        reason: 'busy',
      });
      const result = await pending;
      assert.equal(result.kind, 'routes');
      if (result.kind !== 'routes') return;
      assert.deepEqual(
        result.routes.map((r) => r.mode),
        ['car', 'train', 'walk', 'cycle'],
      );
      assert.deepEqual(
        result.outcomes.map((r) => r.kind),
        Array(4).fill('available'),
      );
    },
  );
  assert.equal(requests, 4);
  assert.equal(peak, 2);
});

test('upstream status, redirects, malformed output, oversize and timeouts fail without retries or sensitive output', async () => {
  let requests = 0;
  let scenario = 'error';
  await fixture(
    (_req, res) => {
      requests++;
      if (scenario === 'timeout') return;
      if (scenario === 'redirect') {
        res.writeHead(302, { Location: 'http://127.0.0.1:1/private' });
        res.end();
        return;
      }
      if (scenario === 'error') {
        res.writeHead(429);
        res.end('provider-secret precise-location');
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      if (scenario === 'body-timeout') {
        res.write('{');
        return;
      }
      if (scenario === 'malformed') res.end('{');
      if (scenario === 'oversize') res.end(' '.repeat(131073));
      if (scenario === 'declared-oversize') {
        res.setHeader('Content-Length', '200000');
        res.end();
      }
      if (scenario === 'empty') res.end('{}');
    },
    async (env) => {
      const provider = createRouteProvider({
        ...env,
        AMR_ROUTES_TIMEOUT_MS: '50',
      });
      for (const [name, reason] of [
        ['error', 'provider_error'],
        ['redirect', 'provider_error'],
        ['malformed', 'provider_error'],
        ['oversize', 'response_too_large'],
        ['declared-oversize', 'response_too_large'],
        ['timeout', 'timeout'],
        ['body-timeout', 'timeout'],
        ['empty', 'no_route'],
      ]) {
        scenario = name;
        const started = performance.now();
        const result = await provider.search(input);
        assert.equal(result.kind, 'unavailable');
        if (result.kind !== 'unavailable') continue;
        assert.deepEqual(result.outcomes, [
          { mode: 'DRIVE', kind: 'unavailable', reason },
        ]);
        assert.ok(performance.now() - started < 1000);
        assert.ok(!JSON.stringify(result).includes('provider-secret'));
        assert.ok(!JSON.stringify(result).includes('precise-location'));
      }
    },
  );
  assert.equal(requests, 8);
});

test('malformed route contradictions and coercible values never reach calculations', async () => {
  const valid = response();
  const cases: unknown[] = [
    { ...valid, extra: 'unknown' },
    { routes: [{ ...valid.routes[0], distanceMeters: '10000' }] },
    { routes: [{ ...valid.routes[0], distanceMeters: 1 }] },
    { routes: [{ ...valid.routes[0], duration: '1s' }] },
    { routes: [{ ...valid.routes[0], duration: 'NaNs' }] },
    response('WALK'),
    { routes: [{ ...valid.routes[0], legs: [{ steps: [] }] }] },
    { routes: Array(4).fill(valid.routes[0]) },
    {
      routes: [
        {
          ...valid.routes[0],
          legs: [
            {
              steps: [
                {
                  ...valid.routes[0].legs[0].steps[0],
                  transitDetails: { transitLine: { vehicle: { type: 'BUS' } } },
                },
              ],
            },
          ],
        },
      ],
    },
  ];
  let index = 0;
  await fixture(
    (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(cases[index++]));
    },
    async (env) => {
      const provider = createRouteProvider(env);
      for (let caseIndex = 0; caseIndex < cases.length; caseIndex++) {
        const result = await provider.search(input);
        assert.equal(result.kind, 'unavailable');
        if (result.kind === 'unavailable')
          assert.deepEqual(result.outcomes, [
            { mode: 'DRIVE', kind: 'unavailable', reason: 'missing_data' },
          ]);
      }
    },
  );
});

test('global minute budget caps repeated queries at 60 paid attempts', async () => {
  let requests = 0;
  await fixture(
    (_req, res) => {
      requests++;
      res.setHeader('Content-Type', 'application/json');
      res.end('{}');
    },
    async (env) => {
      const provider = createRouteProvider(env);
      for (let i = 0; i < 15; i++)
        await provider.search({
          ...input,
          modes: ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'],
        });
      assert.deepEqual(await provider.search(input), {
        kind: 'unavailable',
        reason: 'budget_exhausted',
      });
    },
  );
  assert.equal(requests, 60);
});

test('fixture configuration refuses real keys and production loopback, and sanitizes configuration errors', () => {
  const fixtureEnv = {
    NODE_ENV: 'test',
    AMR_ROUTES_SYNTHETIC: 'true',
    AMR_GOOGLE_ROUTES_ENDPOINT:
      'http://127.0.0.1:1234/directions/v2:computeRoutes',
  };
  for (const env of [
    { ...fixtureEnv, AMR_GOOGLE_ROUTES_KEY: 'private-key-do-not-leak' },
    { ...fixtureEnv, NODE_ENV: 'production' },
    {
      ...fixtureEnv,
      AMR_GOOGLE_ROUTES_ENDPOINT:
        'http://localhost:1234/directions/v2:computeRoutes',
    },
    {
      ...fixtureEnv,
      AMR_GOOGLE_ROUTES_ENDPOINT:
        'http://127.0.0.1:1234/directions/v2:computeRoutes?secret=private',
    },
    { AMR_ROUTES_TIMEOUT_MS: '5001' },
    { AMR_ROUTES_TIMEOUT_MS: 'NaN' },
    { AMR_ROUTES_SYNTHETIC: 'yes' },
  ])
    assert.throws(() => createRouteProvider(env), {
      message: 'Invalid route provider configuration.',
    });
});

test('lifetime cost ceiling survives minute-window rollover and transport emits no sensitive logs', async (context) => {
  let now = Date.now(),
    requests = 0;
  context.mock.method(Date, 'now', () => now);
  const logs: string[] = [];
  for (const level of ['log', 'warn', 'error', 'info', 'debug'] as const)
    context.mock.method(console, level, (...args: unknown[]) =>
      logs.push(args.map(String).join(' ')),
    );
  await fixture(
    (_req, res) => {
      requests++;
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        '{"secret":"amr-synthetic-routes","location":"private-coordinate"}',
      );
    },
    async (env) => {
      const provider = createRouteProvider(env);
      for (let i = 0; i < 250; i++) {
        if (i % 15 === 0) now += 60001;
        const result = await provider.search({
          ...input,
          modes: ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'],
        });
        assert.equal(result.kind, 'unavailable');
        assert.ok(!JSON.stringify(result).includes('private-coordinate'));
      }
      now += 60001;
      assert.deepEqual(await provider.search(input), {
        kind: 'unavailable',
        reason: 'budget_exhausted',
      });
    },
  );
  assert.equal(requests, 1000);
  assert.deepEqual(logs, []);
});
