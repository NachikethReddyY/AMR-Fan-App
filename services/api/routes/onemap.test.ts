import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, type RequestListener } from 'node:http';
import { once } from 'node:events';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRouteProvider } from './provider.ts';
import { readOneMapCredentials } from './onemap.ts';
import { createRouteQuery } from './query.ts';
import {
  road,
  roadFor,
  transit,
  address,
  start,
  end,
} from './testing/onemap-fixtures.ts';
const input = {
  origin: start,
  destination: end,
  modes: ['DRIVE'],
  extraMinutes: 2,
};
async function fixture(
  handler: RequestListener,
  run: (env: Record<string, string>) => Promise<void>,
) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const a = server.address();
    assert.ok(a && typeof a === 'object');
    await run({
      NODE_ENV: 'test',
      AMR_ROUTES_PROVIDER: 'onemap',
      AMR_ROUTES_SYNTHETIC: 'true',
      AMR_ONEMAP_BASE_URL: `http://127.0.0.1:${a.port}`,
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    assert.equal(server.listening, false);
  }
}
test('OneMap stays disabled without assigned credentials and rejects unsafe config', async () => {
  assert.deepEqual(
    await createRouteProvider({ AMR_ROUTES_PROVIDER: 'onemap' }).search(input),
    { kind: 'unavailable', reason: 'live_not_configured' },
  );
  for (const env of [
    { AMR_ROUTES_PROVIDER: 'unknown' },
    { AMR_ROUTES_PROVIDER: 'onemap', AMR_ONEMAP_BASE_URL: 'https://evil.test' },
    {
      AMR_ROUTES_PROVIDER: 'onemap',
      AMR_ROUTES_SYNTHETIC: 'true',
      NODE_ENV: 'production',
    },
    {
      AMR_ROUTES_PROVIDER: 'onemap',
      AMR_ONEMAP_CREDENTIALS_FILE: 'relative.json',
    },
    {
      AMR_ROUTES_PROVIDER: 'onemap',
      AMR_ROUTES_SYNTHETIC: 'true',
      NODE_ENV: 'test',
      AMR_ONEMAP_BASE_URL: 'http://127.0.0.1:1234',
      AMR_ONEMAP_CREDENTIALS_FILE: '/unassigned',
    },
  ])
    assert.throws(() => createRouteProvider(env), {
      message: 'Invalid route provider configuration.',
    });
});

test('credential files accept the supplied APIKKEY spelling as an access token', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'amr-onemap-alias-'));
  const path = join(directory, 'credentials.json');
  try {
    await writeFile(
      path,
      JSON.stringify({
        ONEMAP_EMAIL: 'synthetic@example.invalid',
        ONEMAP_APIKKEY: 'synthetic-access-token',
      }),
      { mode: 0o600 },
    );
    await chmod(path, 0o600);
    const credentials = await readOneMapCredentials(path);
    assert.ok('kind' in credentials);
    if ('kind' in credentials) {
      assert.equal(credentials.value, 'synthetic-access-token');
      assert.ok(credentials.expires > Date.now());
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('real HTTP OneMap query resolves addresses once, caches token, preserves calculations and caps concurrency', async () => {
  const paths: string[] = [];
  let active = 0,
    peak = 0;
  const logs: string[] = [];
  await fixture(
    async (req, res) => {
      const url = new URL(req.url ?? '', 'http://127.0.0.1');
      paths.push(url.pathname);
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname === '/api/auth/post/getToken') {
        assert.equal(req.method, 'POST');
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(Buffer.from(c));
        assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), {
          email: 'synthetic@example.invalid',
          password: 'amr-synthetic-onemap',
        });
        return res.end(
          JSON.stringify({
            access_token: 'synthetic-token',
            expiry_timestamp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
        );
      }
      assert.equal(req.headers.authorization, 'synthetic-token');
      assert.equal(url.searchParams.has('token'), false);
      if (url.pathname === '/api/common/elastic/search') {
        assert.equal(url.searchParams.get('pageNum'), '1');
        return res.end(JSON.stringify(address()));
      }
      assert.equal(url.pathname, '/api/public/routingsvc/route');
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      const type = url.searchParams.get('routeType');
      if (type === 'pt') {
        assert.equal(url.searchParams.get('mode'), 'TRANSIT');
        assert.equal(url.searchParams.get('numItineraries'), '3');
        assert.match(url.searchParams.get('date') ?? '', /^\d{2}-\d{2}-\d{4}$/);
      }
      res.end(
        JSON.stringify(
          type === 'pt'
            ? transit()
            : {
                ...roadFor(
                  type === 'walk'
                    ? 'WALK'
                    : type === 'cycle'
                      ? 'BICYCLE'
                      : 'DRIVE',
                ),
                route_summary: {
                  ...road.route_summary,
                  total_time:
                    type === 'walk' ? 900 : type === 'cycle' ? 800 : 600,
                },
              },
        ),
      );
    },
    async (env) => {
      const query = createRouteQuery({ env });
      await assert.rejects(query(null, input));
      assert.equal(paths.length, 0);
      const raw = {
        ...input,
        origin: 'Synthetic address',
        modes: ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'],
      };
      const pending = query({ principalId: 'a', role: 'fan' }, raw);
      assert.deepEqual(
        (await query({ principalId: 'b', role: 'fan' }, input)).result,
        { kind: 'unavailable', reason: 'busy' },
      );
      const result = await pending;
      assert.equal(result.result.kind, 'routes');
      if (result.result.kind === 'routes') {
        assert.equal(result.result.source.kind, 'fixture');
        assert.match(JSON.stringify(result.result.source), /OneMap/);
        assert.equal(result.result.routes.length, 4);
      }
      assert.equal(result.recommendation.kind, 'recommended');
      if (result.recommendation.kind === 'recommended') {
        assert.equal(result.recommendation.fastestSeconds, 600);
        assert.equal(result.recommendation.limitSeconds, 720);
        assert.equal(result.recommendation.route.mode, 'bus');
      }
      assert.equal(result.calculationStatus, 'indicative_demo');
      await query({ principalId: 'a', role: 'fan' }, input);
      assert.equal(paths.filter((p) => p.endsWith('getToken')).length, 1);
      assert.equal(paths.filter((p) => p.endsWith('search')).length, 1);
      logs.push(JSON.stringify(result));
    },
  );
  assert.equal(peak, 2);
  assert.equal(paths.length, 7);
  assert.ok(!logs.join('').includes('synthetic-token'));
});
test('auth failures have cooldown, revoked tokens do not trigger a refresh storm, and foreign inputs spend nothing', async (context) => {
  let now = Date.now();
  context.mock.method(Date, 'now', () => now);
  let calls = 0,
    auth = 0,
    failAuth = true;
  await fixture(
    (req, res) => {
      calls++;
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/auth/post/getToken') {
        auth++;
        if (failAuth) {
          res.statusCode = 401;
          return res.end('private-provider-body');
        }
        return res.end(
          JSON.stringify({
            access_token: 'synthetic-token',
            expiry_timestamp: String(Math.floor(now / 1000) + 120),
          }),
        );
      }
      res.statusCode = 401;
      res.end('private-provider-body');
    },
    async (env) => {
      const provider = createRouteProvider(env);
      assert.equal(
        (
          await provider.search({
            ...input,
            origin: { latitude: 51.5, longitude: -0.1 },
          })
        ).kind,
        'unavailable',
      );
      assert.equal(calls, 0);
      for (let i = 0; i < 4; i++) await provider.search(input);
      assert.equal(auth, 1);
      now += 61000;
      failAuth = false;
      await provider.search(input);
      assert.equal(auth, 2);
      for (let i = 0; i < 3; i++) await provider.search(input);
      assert.equal(auth, 2);
      assert.equal(calls, 3);
      now += 61000;
      await provider.search(input);
      assert.equal(auth, 3);
    },
  );
});
test('bounded failures and no retries include bodies, deadlines, redirects, address ambiguity and empty transit', async () => {
  let scenario = 'large',
    routes = 0;
  await fixture(
    (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/auth/post/getToken')
        return res.end(
          JSON.stringify({
            access_token: 'synthetic-token',
            expiry_timestamp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
        );
      if (req.url?.includes('/search'))
        return res.end(JSON.stringify({ ...address(), found: 2 }));
      routes++;
      if (scenario === 'timeout') {
        res.write('{');
        return;
      }
      if (scenario === 'large') return res.end(' '.repeat(131073));
      if (scenario === 'redirect') {
        res.writeHead(302, { Location: 'http://127.0.0.1:1/private' });
        return res.end();
      }
      if (scenario === 'empty')
        return res.end(JSON.stringify({ plan: { itineraries: [] } }));
      res.end('{');
    },
    async (env) => {
      const provider = createRouteProvider({
        ...env,
        AMR_ROUTES_TIMEOUT_MS: '100',
      });
      for (const [s, reason] of [
        ['large', 'response_too_large'],
        ['timeout', 'timeout'],
        ['redirect', 'provider_error'],
        ['invalid', 'provider_error'],
        ['empty', 'no_route'],
      ]) {
        scenario = s;
        const result = await provider.search({
          ...input,
          modes: [s === 'empty' ? 'TRANSIT' : 'DRIVE'],
        });
        assert.equal(result.kind, 'unavailable');
        if (result.kind === 'unavailable')
          assert.equal(
            result.outcomes?.[0].kind === 'unavailable'
              ? result.outcomes[0].reason
              : null,
            reason,
          );
      }
      const result = await provider.search({ ...input, origin: 'ambiguous' });
      assert.equal(result.kind, 'unavailable');
      assert.equal(routes, 5);
    },
  );
});

test('secure credential file enforces private permissions, bounded JSON and no symlink', async () => {
  const { mkdtemp, writeFile, chmod, symlink, rm } =
    await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { readOneMapCredentials } = await import('./onemap.ts');
  const dir = await mkdtemp(join(tmpdir(), 'amr-onemap-test-'));
  try {
    const path = join(dir, 'credentials.json');
    const value = {
      email: 'synthetic@example.invalid',
      password: 'synthetic-only',
    };
    await writeFile(path, JSON.stringify(value), { mode: 0o600 });
    assert.deepEqual(await readOneMapCredentials(path), value);
    await chmod(path, 0o644);
    await assert.rejects(readOneMapCredentials(path));
    await chmod(path, 0o600);
    await symlink(path, join(dir, 'link'));
    await assert.rejects(readOneMapCredentials(join(dir, 'link')));
    await writeFile(path, ' '.repeat(16385));
    await assert.rejects(readOneMapCredentials(path));
    await writeFile(path, JSON.stringify({ ...value, unexpected: true }));
    await assert.rejects(readOneMapCredentials(path));
    await assert.rejects(
      readOneMapCredentials(
        new URL('../../package.json', import.meta.url).pathname,
      ),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('token renews near expiry and all address/auth/mode work fits minute and lifetime budgets', async (context) => {
  let now = Date.now(),
    auth = 0,
    calls = 0;
  context.mock.method(Date, 'now', () => now);
  await fixture(
    (req, res) => {
      calls++;
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/auth/post/getToken') {
        auth++;
        return res.end(
          JSON.stringify({
            access_token: `synthetic-${auth}`,
            expiry_timestamp: String(Math.floor(now / 1000) + 120),
          }),
        );
      }
      res.end(JSON.stringify(roadFor('DRIVE')));
    },
    async (env) => {
      const provider = createRouteProvider(env);
      await provider.search(input);
      await provider.search(input);
      assert.equal(auth, 1);
      now += 61000;
      await provider.search(input);
      assert.equal(auth, 2);
      for (let i = 0; i < 29; i++) await provider.search(input);
      assert.deepEqual(await provider.search(input), {
        kind: 'unavailable',
        reason: 'budget_exhausted',
      });
      // Each coordinate query reserves 2 calls, even when auth is cached.
      for (let i = 32; i < 500; i++) {
        if (i % 30 === 2) now += 61000;
        await provider.search(input);
      }
      now += 61000;
      assert.deepEqual(await provider.search(input), {
        kind: 'unavailable',
        reason: 'budget_exhausted',
      });
      assert.ok(calls <= 1000);
    },
  );
});
test('OneMap evidence fits existing prepared journey projection without another query or changed metrics', async () => {
  const { projectPlanDisplay, routeSnapshots } =
    await import('../journeys/planning.ts');
  let calls = 0;
  await fixture(
    (req, res) => {
      calls++;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify(
          req.url === '/api/auth/post/getToken'
            ? {
                access_token: 'synthetic-token',
                expiry_timestamp: String(Math.floor(Date.now() / 1000) + 3600),
              }
            : roadFor('DRIVE'),
        ),
      );
    },
    async (env) => {
      const result = await createRouteQuery({ env })(
        { principalId: 'a', role: 'fan' },
        input,
      );
      const before = JSON.stringify(result);
      const display = projectPlanDisplay(result);
      const snapshots = routeSnapshots(result);
      assert.equal(calls, 2);
      assert.equal(snapshots.length, 1);
      assert.equal(display.routes[0].distanceMeters, 1000);
      assert.equal(snapshots[0].kind, 'available');
      if (snapshots[0].kind === 'available')
        assert.equal(snapshots[0].snapshot.source.kind, 'fixture');
      assert.equal(snapshots[0].routeId, 'onemap-drive-0');
      assert.equal(JSON.stringify(result), before);
    },
  );
});

test('query keeps genuine modes and disconnected transit honest through journey selection', async () => {
  const { routeSnapshots } = await import('../journeys/planning.ts');
  let disconnected = false;
  const requested: string[] = [];
  await fixture(
    (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/auth/post/getToken')
        return res.end(
          JSON.stringify({
            access_token: 'synthetic-token',
            expiry_timestamp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
        );
      const type = new URL(req.url ?? '', 'http://127.0.0.1').searchParams.get(
        'routeType',
      );
      assert.ok(type);
      requested.push(type);
      const pt = transit();
      if (disconnected) {
        // Actual returned polylines have a gap. No endpoint-only fixture shortcut.
        pt.plan.itineraries[0].legs[1].legGeometry.points = 'oa|FoezxRoX?';
        pt.plan.itineraries[0].legs[1].from.lat = 1.296;
      }
      res.end(
        JSON.stringify(
          type === 'pt' ? pt : type === 'drive' ? roadFor('DRIVE') : road,
        ),
      );
    },
    async (env) => {
      const query = createRouteQuery({ env });
      const request = {
        ...input,
        modes: ['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT'],
      };
      const actor = { principalId: 'a', role: 'fan' } as const;
      const first = await query(actor, request);
      assert.equal(first.result.kind, 'routes');
      if (first.result.kind !== 'routes') return;
      assert.deepEqual(
        first.result.routes.map((r) => r.mode),
        ['car', 'walk', 'bus'],
      );
      assert.deepEqual(
        first.result.outcomes.find((o) => o.mode === 'BICYCLE'),
        {
          mode: 'BICYCLE',
          kind: 'unavailable',
          reason: 'missing_data',
        },
      );
      assert.equal(
        routeSnapshots(first).find((r) => r.routeId === 'onemap-transit-0')
          ?.kind,
        'available',
      );
      disconnected = true;
      const second = await query(actor, request);
      assert.equal(second.result.kind, 'routes');
      if (second.result.kind !== 'routes') return;
      // The disconnected transit candidate leaves the comparison instead of
      // withholding it; verified car and walk still compare.
      assert.equal(second.recommendation.kind, 'recommended');
      if (second.recommendation.kind === 'recommended') {
        assert.equal(second.recommendation.route.mode, 'walk');
        assert.equal(second.recommendation.fastestSeconds, 600);
        assert.equal(second.recommendation.limitSeconds, 720);
        assert.ok(Math.abs(second.recommendation.avoidedKgCo2e - 0.17) < 1e-9);
      }
      assert.deepEqual(
        routeSnapshots(second).find((r) => r.routeId === 'onemap-transit-0'),
        {
          kind: 'unavailable',
          routeId: 'onemap-transit-0',
          reason: 'missing_geometry',
        },
      );
      assert.deepEqual(requested, [
        'drive',
        'walk',
        'cycle',
        'pt',
        'drive',
        'walk',
        'cycle',
        'pt',
      ]);
    },
  );
});
