import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRouteQuery } from '../routes/query.ts';
import { planTransport } from '../transport/planner.ts';
import type { ProviderResult } from '../routes/provider.ts';
import { buildTransportRankSnapshot, rankTransportChoice } from './jev-rank.ts';
import type {
  TransportEstimate,
  TransportRoute,
} from '../transport/contracts.ts';

const input = {
  origin: 'Singapore',
  destination: 'Botanic Gardens',
  modes: ['DRIVE', 'TRANSIT'],
  extraMinutes: 10,
};

function routeServer(
  options: { minutes?: Record<string, number>; missing?: string[] } = {},
) {
  return createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const { travelMode } = JSON.parse(Buffer.concat(chunks).toString());
    const minutes =
      options.minutes?.[travelMode] ?? (travelMode === 'DRIVE' ? 30 : 40);
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        routes: [
          {
            distanceMeters: 10000,
            duration: `${minutes * 60}s`,
            ...(options.missing?.includes(travelMode)
              ? {}
              : {
                  polyline: { encodedPolyline: 'o}zFoezxRo}@?' },
                }),
            legs: [
              {
                startLocation: {
                  latLng: { latitude: 1.29, longitude: 103.85 },
                },
                endLocation: { latLng: { latitude: 1.3, longitude: 103.85 } },
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
}

async function listen(server: ReturnType<typeof createServer>) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return address.port;
}

function close(server: ReturnType<typeof createServer>) {
  server.closeAllConnections();
  return new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

test('jev rank stays disabled by default and keeps the deterministic recommendation', async () => {
  const routes = routeServer();
  try {
    const routePort = await listen(routes);
    const query = createRouteQuery({
      env: {
        NODE_ENV: 'test',
        AMR_ROUTES_SYNTHETIC: 'true',
        AMR_GOOGLE_ROUTES_ENDPOINT: `http://127.0.0.1:${routePort}/directions/v2:computeRoutes`,
      },
    });
    const result = await query(
      { principalId: 'account-a', role: 'fan' },
      input,
    );
    assert.deepEqual(result.jev, {
      kind: 'unavailable',
      reason: 'disabled',
      fallback: 'deterministic',
    });
    assert.equal(result.recommendation.kind, 'recommended');
  } finally {
    await close(routes);
  }
});

test('jev rank orders verified routes through the decisions endpoint', async () => {
  const routes = routeServer();
  let decisionsCalls = 0;
  let decisionsModel: unknown = null;
  const decisions = createServer(async (req, res) => {
    decisionsCalls++;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    decisionsModel = body.model;
    const state = JSON.parse(body.state);
    const ids = state.routes.map((route: { id: string }) => route.id);
    assert.ok(ids.includes('google-car-0') && ids.includes('google-train-0'));
    const choice = ids.find((id: string) => id !== 'google-car-0');
    const probabilities = Object.fromEntries(
      ids.map((id: string) => [
        id,
        id === choice ? 0.7 : 0.3 / (ids.length - 1),
      ]),
    );
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        model: 'typesafe/jev-1.13-20260917',
        answers: {
          preference: {
            type: 'choice',
            choice,
            probabilities,
            confidence: 0.8,
          },
        },
        usage: { input_tokens: 100, output_tokens: 10 },
      }),
    );
  });
  try {
    const routePort = await listen(routes);
    const decisionsPort = await listen(decisions);
    const query = createRouteQuery({
      env: {
        NODE_ENV: 'test',
        AMR_ROUTES_SYNTHETIC: 'true',
        AMR_GOOGLE_ROUTES_ENDPOINT: `http://127.0.0.1:${routePort}/directions/v2:computeRoutes`,
        JEV_RANK_ENABLED: 'true',
        JEV_API_KEY: 'synthetic-jev-key',
        JEV_DECISIONS_URL: `http://127.0.0.1:${decisionsPort}/api/alpha/decisions`,
      },
    });
    const result = await query(
      { principalId: 'account-b', role: 'fan' },
      input,
    );
    assert.equal(decisionsCalls, 1);
    assert.equal(decisionsModel, 'typesafe/jev-1.13');
    assert.equal(result.jev.kind, 'ranked');
    if (result.jev.kind === 'ranked') {
      assert.deepEqual(result.jev.orderedRouteIds, [
        'google-train-0',
        'google-car-0',
      ]);
      assert.equal(result.jev.confidence, 0.8);
    }
    assert.equal(result.recommendation.kind, 'recommended');
  } finally {
    await close(routes);
    await close(decisions);
  }
});

test('a lone verified route makes no call; nothing to choose', async () => {
  const routes = routeServer();
  let decisionsCalls = 0;
  const decisions = createServer(async (_req, res) => {
    decisionsCalls++;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({}));
  });
  try {
    const routePort = await listen(routes);
    const decisionsPort = await listen(decisions);
    const query = createRouteQuery({
      env: {
        NODE_ENV: 'test',
        AMR_ROUTES_SYNTHETIC: 'true',
        AMR_GOOGLE_ROUTES_ENDPOINT: `http://127.0.0.1:${routePort}/directions/v2:computeRoutes`,
        JEV_RANK_ENABLED: 'true',
        JEV_API_KEY: 'synthetic-jev-key',
        JEV_DECISIONS_URL: `http://127.0.0.1:${decisionsPort}/api/alpha/decisions`,
      },
    });
    // The 40-minute walk is capped out, leaving only the car: ranking one
    // option would be pure spend, so the snapshot stays unavailable.
    const result = await query(
      { principalId: 'account-d', role: 'fan' },
      { ...input, modes: ['DRIVE', 'WALK'] },
    );
    assert.equal(decisionsCalls, 0);
    assert.deepEqual(result.jev, {
      kind: 'unavailable',
      reason: 'missing-metrics',
      fallback: 'deterministic',
    });
    assert.equal(result.recommendation.kind, 'recommended');
  } finally {
    await close(routes);
    await close(decisions);
  }
});

test('unverified routes are narrowed out of the jev choice set', async () => {
  const routes = routeServer({ minutes: { WALK: 20 }, missing: ['TRANSIT'] });
  let decisionsCalls = 0;
  const decisions = createServer(async (req, res) => {
    decisionsCalls++;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const state = JSON.parse(body.state);
    const ids = state.routes.map((route: { id: string }) => route.id);
    assert.deepEqual(ids, ['google-car-0', 'google-walk-0']);
    const probabilities: Record<string, number> = {
      'google-car-0': 0.4,
      'google-walk-0': 0.6,
    };
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        model: 'typesafe/jev-1.13-20260917',
        answers: {
          preference: {
            type: 'choice',
            choice: 'google-walk-0',
            probabilities,
            confidence: 0.7,
          },
        },
        usage: { input_tokens: 80, output_tokens: 8 },
      }),
    );
  });
  try {
    const routePort = await listen(routes);
    const decisionsPort = await listen(decisions);
    const query = createRouteQuery({
      env: {
        NODE_ENV: 'test',
        AMR_ROUTES_SYNTHETIC: 'true',
        AMR_GOOGLE_ROUTES_ENDPOINT: `http://127.0.0.1:${routePort}/directions/v2:computeRoutes`,
        JEV_RANK_ENABLED: 'true',
        JEV_API_KEY: 'synthetic-jev-key',
        JEV_DECISIONS_URL: `http://127.0.0.1:${decisionsPort}/api/alpha/decisions`,
      },
    });
    const result = await query(
      { principalId: 'account-e', role: 'fan' },
      { ...input, modes: ['DRIVE', 'TRANSIT', 'WALK'] },
    );
    assert.equal(decisionsCalls, 1);
    assert.equal(result.jev.kind, 'ranked');
    if (result.jev.kind === 'ranked') {
      assert.deepEqual(result.jev.orderedRouteIds, [
        'google-walk-0',
        'google-car-0',
      ]);
    }
  } finally {
    await close(routes);
    await close(decisions);
  }
});

test('transport snapshot ranks estimated options with award-rule points', () => {
  const route = (
    id: string,
    mode: TransportRoute['mode'],
    durationSeconds: number,
  ): TransportRoute => ({
    id,
    mode,
    source: { kind: 'simulated', label: 'test', dataFreshness: 'x' },
    legs: [],
    durationSeconds,
    waitSeconds: 0,
    transfers: 0,
    arrivesAt: 'x',
    meetsDeadline: true,
    distanceMeters: 1000,
  });
  const est = (routeId: string, kg: number): TransportEstimate => ({
    routeId,
    estimate: { kind: 'estimated', kgCo2e: kg, factorIds: [] },
    distanceMethod: 'straight_line',
  });
  const built = buildTransportRankSnapshot({
    routes: [
      route('train', 'train', 1249),
      route('car', 'car', 674),
      route('walk', 'walk', 3300),
    ],
    estimates: [est('train', 0.03), est('car', 0.69), est('walk', 0)],
    extraMinutes: 15,
  });
  assert.equal(built.kind, 'prepared');
  if (built.kind === 'prepared') {
    const snapshot = built.snapshot as {
      extraMinutes: number;
      routes: { id: string; points: number }[];
    };
    // The 55-minute walk is capped out; train and car remain.
    assert.deepEqual(
      snapshot.routes.map((item) => item.id),
      ['train', 'car'],
    );
    assert.deepEqual(
      snapshot.routes.map((item) => item.points),
      [33, 0],
    );
  }
  // A lone verified route is not a choice.
  assert.deepEqual(
    buildTransportRankSnapshot({
      routes: [route('car', 'car', 674)],
      estimates: [est('car', 0.69)],
      extraMinutes: 15,
    }),
    { kind: 'unavailable', reason: 'missing-metrics' },
  );
  // No car baseline, no provisional points.
  assert.deepEqual(
    buildTransportRankSnapshot({
      routes: [route('train', 'train', 1249), route('bus', 'bus', 1300)],
      estimates: [est('train', 0.03), est('bus', 0.27)],
      extraMinutes: 15,
    }),
    { kind: 'unavailable', reason: 'missing-metrics' },
  );
});

test('transport plan ranks live options through the decisions endpoint', async () => {
  const at = '2026-10-06T09:00:00+08:00';
  const leg = (
    mode: 'walk' | 'train' | 'bus' | 'car',
    durationSeconds: number,
  ) => ({
    mode,
    distanceMeters: 1000,
    durationSeconds,
    description: mode,
  });
  const providerResult: ProviderResult = {
    kind: 'routes',
    source: { kind: 'live', provider: 'test' },
    routes: [
      {
        id: 'pt-train',
        mode: 'train',
        availability: { kind: 'available' },
        legs: [leg('walk', 200), leg('train', 1049)],
        distanceMeters: 6100,
        durationSeconds: 1249,
      },
      {
        id: 'pt-walk',
        mode: 'walk',
        availability: { kind: 'available' },
        legs: [leg('walk', 3508)],
        distanceMeters: 4873,
        durationSeconds: 3508,
      },
      {
        id: 'pt-car',
        mode: 'car',
        availability: { kind: 'available' },
        legs: [leg('car', 674)],
        distanceMeters: 5626,
        durationSeconds: 674,
      },
    ],
    outcomes: [],
    evidence: [],
    fetchedAt: at,
  };
  let decisionsCalls = 0;
  const decisions = createServer(async (req, res) => {
    decisionsCalls++;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const state = JSON.parse(
      JSON.parse(Buffer.concat(chunks).toString()).state,
    );
    const ids = state.routes.map((route: { id: string }) => route.id);
    // Walk is capped out of the choice set; the stub legs carry no shapes.
    assert.deepEqual(ids, ['live-pt-train-0', 'live-pt-car-2']);
    const probabilities: Record<string, number> = {
      'live-pt-train-0': 0.8,
      'live-pt-car-2': 0.2,
    };
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        model: 'typesafe/jev-1.13-20260917',
        answers: {
          preference: {
            type: 'choice',
            choice: 'live-pt-train-0',
            probabilities,
            confidence: 0.75,
          },
        },
        usage: { input_tokens: 90, output_tokens: 9 },
      }),
    );
  });
  try {
    const decisionsPort = await listen(decisions);
    const plan = await planTransport(
      {
        origin: { latitude: 1.3048, longitude: 103.8329 },
        destination: { latitude: 1.2816, longitude: 103.8602 },
        departAt: at,
      },
      {
        liveRouteProvider: { search: async () => providerResult },
        env: {
          JEV_RANK_ENABLED: 'true',
          JEV_API_KEY: 'synthetic-jev-key',
          JEV_DECISIONS_URL: `http://127.0.0.1:${decisionsPort}/api/alpha/decisions`,
        },
      },
    );
    assert.equal(decisionsCalls, 1);
    assert.equal(plan.jev.kind, 'ranked');
    if (plan.jev.kind === 'ranked') {
      assert.deepEqual(plan.jev.orderedRouteIds, [
        'live-pt-train-0',
        'live-pt-car-2',
      ]);
      assert.equal(plan.jev.confidence, 0.75);
    }
    // The deterministic recommendation is unaffected by the rank.
    assert.equal(plan.recommendation.kind, 'recommended');
  } finally {
    await close(decisions);
  }
});

test('AI_API_KEY acts as the TokenRouter alias for jev', async () => {
  let authorization: unknown = null;
  const decisions = createServer(async (req, res) => {
    authorization = req.headers.authorization;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const state = JSON.parse(
      JSON.parse(Buffer.concat(chunks).toString()).state,
    );
    const ids = state.routes.map((route: { id: string }) => route.id);
    const probabilities: Record<string, number> = {
      'alias-train': 0.9,
      'alias-car': 0.1,
    };
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        model: 'typesafe/jev-1.13-20260917',
        answers: {
          preference: {
            type: 'choice',
            choice: 'alias-train',
            probabilities,
            confidence: 0.9,
          },
        },
        usage: { input_tokens: 10, output_tokens: 2 },
      }),
    );
    void ids;
  });
  const tRoute = (
    id: string,
    mode: TransportRoute['mode'],
    durationSeconds: number,
  ): TransportRoute => ({
    id,
    mode,
    source: { kind: 'simulated', label: 'test', dataFreshness: 'x' },
    legs: [],
    durationSeconds,
    waitSeconds: 0,
    transfers: 0,
    arrivesAt: 'x',
    meetsDeadline: true,
    distanceMeters: 1000,
  });
  const tEst = (routeId: string, kg: number): TransportEstimate => ({
    routeId,
    estimate: { kind: 'estimated', kgCo2e: kg, factorIds: [] },
    distanceMethod: 'straight_line',
  });
  try {
    const decisionsPort = await listen(decisions);
    const rank = await rankTransportChoice(
      {
        JEV_RANK_ENABLED: 'true',
        AI_API_KEY: 'synthetic-alias-key',
        JEV_DECISIONS_URL: `http://127.0.0.1:${decisionsPort}/api/alpha/decisions`,
      },
      {
        routes: [
          tRoute('alias-train', 'train', 1200),
          tRoute('alias-car', 'car', 600),
        ],
        estimates: [tEst('alias-train', 0.05), tEst('alias-car', 0.9)],
        extraMinutes: 15,
      },
    );
    assert.equal(authorization, 'Bearer synthetic-alias-key');
    assert.equal(rank.kind, 'ranked');
    if (rank.kind === 'ranked') {
      assert.deepEqual(rank.orderedRouteIds, ['alias-train', 'alias-car']);
    }
  } finally {
    await close(decisions);
  }
});

test('invalid jev output falls back without touching the deterministic recommendation', async () => {
  const routes = routeServer();
  const decisions = createServer(async (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({ model: 'typesafe/jev-1.13-20260917', answers: {} }),
    );
  });
  try {
    const routePort = await listen(routes);
    const decisionsPort = await listen(decisions);
    const query = createRouteQuery({
      env: {
        NODE_ENV: 'test',
        AMR_ROUTES_SYNTHETIC: 'true',
        AMR_GOOGLE_ROUTES_ENDPOINT: `http://127.0.0.1:${routePort}/directions/v2:computeRoutes`,
        JEV_RANK_ENABLED: 'true',
        JEV_API_KEY: 'synthetic-jev-key',
        JEV_DECISIONS_URL: `http://127.0.0.1:${decisionsPort}/api/alpha/decisions`,
      },
    });
    const result = await query(
      { principalId: 'account-c', role: 'fan' },
      input,
    );
    assert.deepEqual(result.jev, {
      kind: 'unavailable',
      reason: 'invalid-output',
      fallback: 'deterministic',
    });
    assert.equal(result.recommendation.kind, 'recommended');
  } finally {
    await close(routes);
    await close(decisions);
  }
});
