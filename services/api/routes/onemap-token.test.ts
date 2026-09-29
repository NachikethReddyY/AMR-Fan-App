import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { chmod, link, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { routeConfig } from './config.ts';
import { createRouteProvider } from './provider.ts';
import { address, end, roadFor, start } from './testing/onemap-fixtures.ts';

const now = Date.parse('2030-01-01T00:00:00Z');
const input = {
  origin: start,
  destination: end,
  modes: ['DRIVE'],
  extraMinutes: 2,
};
const unavailable = { kind: 'unavailable', reason: 'live_not_configured' };

async function tokenFile(
  run: (env: Record<string, string>, path: string) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), 'amr-synthetic-token-'));
  const path = join(directory, 'token.txt');
  try {
    await writeFile(path, 'synthetic-token\n', { mode: 0o600 });
    await run(
      {
        AMR_ROUTES_PROVIDER: 'onemap',
        AMR_ONEMAP_ACCESS_TOKEN_FILE: path,
        AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: new Date(
          now + 3600000,
        ).toISOString(),
      },
      path,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

// Every fetch in these tests is intercepted. No real token or provider is used.
function intercept(
  context: TestContext,
  handler: (url: URL, init: RequestInit) => Response | Promise<Response>,
) {
  context.mock.method(
    globalThis,
    'fetch',
    async (url: string, init: RequestInit) => {
      const parsed = new URL(url);
      assert.equal(parsed.origin, 'https://www.onemap.gov.sg');
      assert.equal(init.redirect, 'error');
      return handler(parsed, init);
    },
  );
}

test('token config requires an absolute file and valid offset-bearing cutoff, rejecting conflicts and fixtures', async () => {
  await tokenFile(async (env) => {
    assert.deepEqual(routeConfig(env), {
      kind: 'onemap',
      baseUrl: 'https://www.onemap.gov.sg',
      timeoutMs: 3000,
      credentials: {
        kind: 'token-file',
        path: env.AMR_ONEMAP_ACCESS_TOKEN_FILE,
        expires: now + 3600000,
      },
    });
    assert.deepEqual(
      routeConfig({
        ...env,
        AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: '2030-01-01T09:00:00+08:00',
      }),
      routeConfig(env),
    );
    for (const patch of [
      { AMR_ONEMAP_ACCESS_TOKEN_FILE: 'relative.txt' },
      { AMR_ONEMAP_ACCESS_TOKEN_FILE: '' },
      { AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: '' },
      { AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: '2030-01-01' },
      { AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: '2030-01-01T01:00:00' },
      { AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: '2030-02-30T01:00:00Z' },
      { AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: '2030-01-01T01:00:00+25:00' },
      { AMR_ONEMAP_CREDENTIALS_FILE: '/synthetic-credentials.json' },
      {
        AMR_ROUTES_SYNTHETIC: 'true',
        NODE_ENV: 'test',
        AMR_ONEMAP_BASE_URL: 'http://127.0.0.1:1234',
      },
    ])
      assert.throws(() => routeConfig({ ...env, ...patch }), {
        message: 'Invalid route provider configuration.',
      });
    assert.throws(() =>
      routeConfig({
        AMR_ROUTES_PROVIDER: 'onemap',
        AMR_ONEMAP_CREDENTIALS_FILE: '/synthetic.json',
        AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT:
          env.AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT,
      }),
    );
  });
});

test('token file is cached until restart, sent only in Authorization, and never exchanged or charged to Google', async (context) => {
  context.mock.method(Date, 'now', () => now);
  const seen: string[] = [];
  intercept(context, (url, init) => {
    assert.equal(url.pathname, '/api/public/routingsvc/route');
    assert.equal(url.searchParams.has('token'), false);
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
    seen.push(new Headers(init.headers).get('Authorization') ?? '');
    return Response.json(roadFor('DRIVE'));
  });
  await tokenFile(async (env, path) => {
    let reservations = 0;
    const provider = createRouteProvider(env, {
      reserve: async () => {
        reservations++;
        return true;
      },
    });
    const first = await provider.search(input);
    assert.equal(first.kind, 'routes');
    assert.ok(!JSON.stringify(first).includes('synthetic-token'));
    await writeFile(path, 'synthetic-replacement');
    assert.equal((await provider.search(input)).kind, 'routes');
    assert.equal((await createRouteProvider(env).search(input)).kind, 'routes');
    assert.deepEqual(seen, [
      'synthetic-token',
      'synthetic-token',
      'synthetic-replacement',
    ]);
    assert.equal(reservations, 0);
  });
});

test('expired and within-margin tokens make no dispatch, including a cached token reaching its cutoff', async (context) => {
  let clock = now;
  context.mock.method(Date, 'now', () => clock);
  let calls = 0;
  intercept(context, () => {
    calls++;
    return Response.json(roadFor('DRIVE'));
  });
  await tokenFile(async (env) => {
    for (const remaining of [-1, 0, 60000]) {
      assert.deepEqual(
        await createRouteProvider({
          ...env,
          AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: new Date(
            now + remaining,
          ).toISOString(),
        }).search(input),
        unavailable,
      );
    }
    assert.equal(calls, 0);
    const provider = createRouteProvider({
      ...env,
      AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: new Date(now + 60001).toISOString(),
    });
    assert.equal((await provider.search(input)).kind, 'routes');
    clock++;
    assert.deepEqual(await provider.search(input), unavailable);
    clock = now;
    assert.deepEqual(await provider.search(input), unavailable);
    assert.equal(calls, 1);
  });
});

test('cutoff is checked between address calls and before either route batch dispatch', async (context) => {
  let clock = now;
  context.mock.method(Date, 'now', () => clock);
  let paths: string[] = [];
  intercept(context, (url) => {
    paths.push(url.pathname);
    clock = now + 3540000;
    return Response.json(
      url.pathname.includes('/search') ? address() : roadFor('DRIVE'),
    );
  });
  await tokenFile(async (env) => {
    assert.deepEqual(
      await createRouteProvider(env).search({
        ...input,
        origin: 'Synthetic A',
        destination: 'Synthetic B',
      }),
      unavailable,
    );
    assert.deepEqual(paths, ['/api/common/elastic/search']);
    paths = [];
    clock = now;
    assert.deepEqual(
      await createRouteProvider(env).search({
        ...input,
        origin: 'Synthetic A',
      }),
      {
        kind: 'unavailable',
        reason: 'provider_error',
        outcomes: [{ mode: 'DRIVE', ...unavailable }],
      },
    );
    assert.deepEqual(paths, ['/api/common/elastic/search']);
    paths = [];
    clock = now;
    await createRouteProvider(env).search({
      ...input,
      modes: ['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT'],
    });
    assert.equal(
      paths.length,
      1,
      'even the second dispatch in a batch rechecks cutoff',
    );
  });
});

test('invalid files stay unavailable until restart and expired cutoffs cannot rotate by file replacement alone', async (context) => {
  let clock = now;
  context.mock.method(Date, 'now', () => clock);
  let calls = 0;
  intercept(context, (_url, init) => {
    calls++;
    assert.equal(
      new Headers(init.headers).get('Authorization'),
      'synthetic-replacement',
    );
    return Response.json(roadFor('DRIVE'));
  });
  await tokenFile(async (env, path) => {
    await writeFile(path, '');
    const provider = createRouteProvider(env);
    assert.deepEqual(await provider.search(input), unavailable);
    await writeFile(path, 'synthetic-replacement');
    assert.deepEqual(await provider.search(input), unavailable);
    assert.equal(calls, 0);
    assert.equal((await createRouteProvider(env).search(input)).kind, 'routes');
    clock = now + 3600000;
    assert.deepEqual(await createRouteProvider(env).search(input), unavailable);
    assert.equal(calls, 1);
    assert.equal(
      (
        await createRouteProvider({
          ...env,
          AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: new Date(
            clock + 3600000,
          ).toISOString(),
        }).search(input)
      ).kind,
      'routes',
    );
    assert.equal(calls, 2);
  });
});

test('expiry after the first concurrent route batch blocks later modes', async (context) => {
  let clock = now;
  context.mock.method(Date, 'now', () => clock);
  const modes: string[] = [];
  intercept(context, async (url) => {
    modes.push(url.searchParams.get('routeType') ?? '');
    await Promise.resolve();
    clock = now + 3540000;
    return Response.json(
      roadFor(url.searchParams.get('routeType') === 'drive' ? 'DRIVE' : 'WALK'),
    );
  });
  await tokenFile(async (env) => {
    const result = await createRouteProvider(env).search({
      ...input,
      modes: ['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT'],
    });
    assert.equal(result.kind, 'routes');
    assert.deepEqual(modes, ['drive', 'walk']);
    assert.deepEqual(result.outcomes?.slice(2), [
      { mode: 'BICYCLE', ...unavailable },
      { mode: 'TRANSIT', ...unavailable },
    ]);
  });
});

for (const status of [401, 403])
  test(`token HTTP ${status} latches until restart without retry, refresh or fallback`, async (context) => {
    let clock = now;
    context.mock.method(Date, 'now', () => clock);
    let calls = 0;
    let reject = true;
    intercept(context, (url, init) => {
      calls++;
      assert.equal(url.pathname, '/api/public/routingsvc/route');
      if (reject) return new Response('synthetic-private-body', { status });
      assert.equal(
        new Headers(init.headers).get('Authorization'),
        'synthetic-replacement',
      );
      return Response.json(roadFor('DRIVE'));
    });
    await tokenFile(async (env, path) => {
      const provider = createRouteProvider({
        ...env,
        AMR_GOOGLE_ROUTES_KEY: 'synthetic-google-key',
      });
      const first = await provider.search(input);
      assert.equal(first.kind, 'unavailable');
      assert.ok(!JSON.stringify(first).includes('synthetic-private-body'));
      clock += 61000;
      reject = false;
      await writeFile(path, 'synthetic-replacement');
      for (let i = 0; i < 3; i++)
        assert.deepEqual(await provider.search(input), {
          kind: 'unavailable',
          reason: 'provider_error',
        });
      assert.equal(calls, 1);
      assert.equal(
        (await createRouteProvider(env).search(input)).kind,
        'routes',
      );
      assert.equal(calls, 2);
    });
  });

test('rejection in the first route batch prevents subsequent modes', async (context) => {
  context.mock.method(Date, 'now', () => now);
  let calls = 0;
  intercept(context, () => {
    calls++;
    return new Response(null, { status: 401 });
  });
  await tokenFile(async (env) => {
    const result = await createRouteProvider(env).search({
      ...input,
      modes: ['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT'],
    });
    assert.equal(result.kind, 'unavailable');
    assert.equal(
      calls,
      2,
      'already dispatched parallel calls can finish; later calls are blocked',
    );
  });
});

test('private token files reject unsafe metadata and malformed content without dispatch', async (context) => {
  context.mock.method(Date, 'now', () => now);
  let calls = 0;
  intercept(context, () => {
    calls++;
    return Response.json(roadFor('DRIVE'));
  });
  await tokenFile(async (env, path) => {
    const check = async (file = path) =>
      assert.deepEqual(
        await createRouteProvider({
          ...env,
          AMR_ONEMAP_ACCESS_TOKEN_FILE: file,
        }).search(input),
        unavailable,
      );
    for (const content of [
      '',
      'Bearer synthetic',
      'synthetic\ntoken',
      'synthetic\n\n',
      ' synthetic',
      'synthetic ',
      '{"access_token":"synthetic"}',
      'x'.repeat(8193),
    ]) {
      await writeFile(path, content);
      await check();
    }
    await writeFile(path, 'synthetic-token');
    await chmod(path, 0o644);
    await check();
    await chmod(path, 0o600);
    await symlink(path, `${path}.symlink`);
    await check(`${path}.symlink`);
    await link(path, `${path}.hardlink`);
    await check();
    await rm(`${path}.hardlink`);
    await check(join(path, '..'));
    await check(`${path}.missing`);
    await check(new URL('../../package.json', import.meta.url).pathname);
    assert.equal(calls, 0);
    await writeFile(path, `${'x'.repeat(8192)}\r\n`);
    assert.equal((await createRouteProvider(env).search(input)).kind, 'routes');
    assert.equal(calls, 1);
  });
});

test('account credential file exchange remains supported and Google selection ignores OneMap token settings', async (context) => {
  context.mock.method(Date, 'now', () => now);
  const paths: string[] = [];
  intercept(context, (url, init) => {
    paths.push(url.pathname);
    if (url.pathname === '/api/auth/post/getToken') {
      assert.equal(
        init.body,
        JSON.stringify({
          email: 'synthetic@example.invalid',
          password: 'synthetic-only',
        }),
      );
      return Response.json({
        access_token: 'synthetic-exchanged',
        expiry_timestamp: String((now + 3600000) / 1000),
      });
    }
    assert.equal(
      new Headers(init.headers).get('Authorization'),
      'synthetic-exchanged',
    );
    return Response.json(roadFor('DRIVE'));
  });
  await tokenFile(async (env, path) => {
    await writeFile(
      path,
      JSON.stringify({
        email: 'synthetic@example.invalid',
        password: 'synthetic-only',
      }),
    );
    assert.equal(
      (
        await createRouteProvider({
          AMR_ROUTES_PROVIDER: 'onemap',
          AMR_ONEMAP_CREDENTIALS_FILE: path,
        }).search(input)
      ).kind,
      'routes',
    );
    assert.deepEqual(paths, [
      '/api/auth/post/getToken',
      '/api/public/routingsvc/route',
    ]);
    assert.deepEqual(routeConfig({ ...env, AMR_ROUTES_PROVIDER: 'google' }), {
      kind: 'disabled',
    });
    assert.equal(
      routeConfig({
        ...env,
        AMR_ROUTES_PROVIDER: 'google',
        AMR_GOOGLE_ROUTES_KEY: 'synthetic-google-key',
      }).kind,
      'google',
    );
    assert.deepEqual(routeConfig({ ...env, AMR_ROUTES_PROVIDER: 'disabled' }), {
      kind: 'disabled',
    });
  });
});
