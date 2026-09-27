import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { get } from 'node:http';
import { once } from 'node:events';
import { prepareOneMapSecret } from './onemap-secret.ts';
import { createRouteProvider } from '../routes/provider.ts';
import { roadFor } from '../routes/testing/onemap-fixtures.ts';

const input = {
  origin: { latitude: 1.29, longitude: 103.85 },
  destination: { latitude: 1.3, longitude: 103.85 },
  modes: ['DRIVE'],
  extraMinutes: 2,
};
function fixture() {
  const directory = fs.mkdtempSync(join(tmpdir(), 'amr-stage-fixture-'));
  const source = join(directory, 'mounted-token');
  const temporaryBase = join(directory, 'private');
  fs.mkdirSync(temporaryBase);
  fs.writeFileSync(source, 'synthetic-staged-token\n', { mode: 0o644 });
  const env = {
    AMR_ROUTES_PROVIDER: 'disabled',
    AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: new Date(
      Date.now() + 3600000,
    ).toISOString(),
  };
  return {
    source,
    temporaryBase,
    env,
    remove: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

test('private copy meets unchanged reader metadata and disabled staging makes no provider calls', async (context) => {
  const f = fixture();
  let calls = 0;
  const providerFetch = context.mock.method(globalThis, 'fetch', () => {
    calls++;
    throw new Error('No provider call allowed');
  });
  try {
    const sourceStat = fs.statSync(f.source);
    const copy = prepareOneMapSecret(f);
    const stat = fs.lstatSync(copy.path);
    assert.ok(stat.isFile());
    assert.equal(stat.uid, process.getuid?.());
    assert.equal(stat.mode & 0o777, 0o600);
    assert.equal(stat.nlink, 1);
    assert.equal(fs.lstatSync(dirname(copy.path)).mode & 0o777, 0o700);
    assert.equal(fs.statSync(dirname(copy.path)).uid, process.getuid?.());
    assert.notEqual(stat.ino, sourceStat.ino);
    assert.equal(
      fs.readFileSync(copy.path, 'utf8'),
      'synthetic-staged-token\n',
    );
    assert.equal(fs.statSync(f.source).mode, sourceStat.mode);
    assert.equal(f.env.AMR_ROUTES_PROVIDER, 'disabled');
    assert.deepEqual(
      await createRouteProvider({
        ...f.env,
        AMR_ONEMAP_ACCESS_TOKEN_FILE: copy.path,
      }).search(input),
      { kind: 'unavailable', reason: 'live_not_configured' },
    );
    assert.equal(calls, 0);
    providerFetch.mock.mockImplementation(
      (_url: unknown, init?: RequestInit) => {
        calls++;
        assert.equal(
          new Headers(init?.headers).get('Authorization'),
          'synthetic-staged-token',
        );
        return Promise.resolve(Response.json(roadFor('DRIVE')));
      },
    );
    assert.equal(
      (
        await createRouteProvider({
          ...f.env,
          AMR_ROUTES_PROVIDER: 'onemap',
          AMR_ONEMAP_ACCESS_TOKEN_FILE: copy.path,
        }).search(input)
      ).kind,
      'routes',
    );
    assert.equal(
      calls,
      1,
      'unchanged strict reader accepts the private copy without token exchange',
    );
    copy.cleanup();
    copy.cleanup();
    assert.deepEqual(fs.readdirSync(f.temporaryBase), []);
    assert.ok(fs.existsSync(f.source));
  } finally {
    f.remove();
  }
});

test('descriptor flags forbid symlinks and nonblocking-source hazards, destination is exclusive', (context) => {
  const f = fixture();
  const opens = context.mock.method(fs, 'openSync');
  try {
    const copy = prepareOneMapSecret(f);
    const source = opens.mock.calls.find(
      (call) => call.arguments[0] === f.source,
    );
    const target = opens.mock.calls.find(
      (call) => call.arguments[0] === copy.path,
    );
    assert.ok(source && target);
    assert.equal(
      source.arguments[1],
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
    );
    assert.equal(
      target.arguments[1],
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_NOFOLLOW,
    );
    assert.equal(target.arguments[2], 0o600);
    copy.cleanup();
  } finally {
    f.remove();
  }
});

test('explicit wrapper rejects missing/malformed cutoff and conflicting modes/config before creating a copy', () => {
  const f = fixture();
  try {
    for (const patch of [
      { AMR_ROUTES_PROVIDER: 'google' },
      { AMR_ROUTES_PROVIDER: '' },
      { AMR_ONEMAP_ACCESS_TOKEN_FILE: '/already-assigned' },
      { AMR_ONEMAP_CREDENTIALS_FILE: '/account-credentials' },
      { AMR_GOOGLE_ROUTES_KEY: 'synthetic-google-key' },
      { AMR_ROUTES_SYNTHETIC: 'true' },
      { AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: '' },
      { AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT: '2030-01-01' },
    ]) {
      assert.throws(
        () => prepareOneMapSecret({ ...f, env: { ...f.env, ...patch } }),
        { message: 'OneMap token staging failed.' },
      );
      assert.deepEqual(fs.readdirSync(f.temporaryBase), []);
    }
    const copy = prepareOneMapSecret({
      ...f,
      env: { ...f.env, AMR_ROUTES_PROVIDER: 'onemap' },
    });
    copy.cleanup();
  } finally {
    f.remove();
  }
});

test('unsafe, missing, oversized and malformed mounted files fail with sanitized errors and no copy', () => {
  const f = fixture();
  try {
    for (const value of [
      '',
      'Bearer synthetic',
      'synthetic\nsecond',
      'x'.repeat(8195),
    ]) {
      fs.writeFileSync(f.source, value);
      assert.throws(() => prepareOneMapSecret(f), {
        message: 'OneMap token staging failed.',
      });
      assert.deepEqual(fs.readdirSync(f.temporaryBase), []);
    }
    fs.writeFileSync(f.source, 'synthetic-staged-token');
    fs.symlinkSync(f.source, `${f.source}.link`);
    for (const source of [
      `${f.source}.missing`,
      `${f.source}.link`,
      f.temporaryBase,
    ]) {
      assert.throws(() => prepareOneMapSecret({ ...f, source }), {
        message: 'OneMap token staging failed.',
      });
      assert.deepEqual(fs.readdirSync(f.temporaryBase), []);
    }
    assert.throws(
      () => prepareOneMapSecret({ ...f, temporaryBase: process.cwd() }),
      { message: 'OneMap token staging failed.' },
    );
  } finally {
    f.remove();
  }
});

test('exclusive-copy failure closes descriptors and deletes only owned file/directory', (context) => {
  const f = fixture();
  try {
    const closes = context.mock.method(fs, 'closeSync');
    const writing = context.mock.method(fs, 'writeSync', () => {
      throw new Error('synthetic-private-error-path-and-content');
    });
    assert.throws(() => prepareOneMapSecret(f), {
      message: 'OneMap token staging failed.',
    });
    assert.deepEqual(fs.readdirSync(f.temporaryBase), []);
    assert.ok(closes.mock.callCount() >= 2);
    writing.mock.restore();
    const copy = prepareOneMapSecret(f);
    fs.writeFileSync(join(dirname(copy.path), 'unrelated'), 'preserve');
    assert.throws(() => copy.cleanup(), {
      message: 'OneMap private token cleanup failed.',
    });
    assert.ok(fs.existsSync(join(dirname(copy.path), 'unrelated')));
    fs.unlinkSync(join(dirname(copy.path), 'unrelated'));
    copy.cleanup();
    copy.cleanup();
    assert.ok(fs.existsSync(f.source));
  } finally {
    f.remove();
  }
});

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

// Real start.ts/createApi and real loopback listener. Only the DB module is replaced;
// no database connection, authentication request, provider request or hosted startup.
async function lifecycle(
  phase: 'preparation' | 'before' | 'during' | 'after' | 'failure' | 'invalid',
  signal: 'SIGTERM' | 'SIGINT',
  expiry?: { provider: 'disabled' | 'onemap'; cutoff: string },
  invalidCutoff?: string,
) {
  const f = fixture();
  if (expiry) {
    f.env.AMR_ROUTES_PROVIDER = expiry.provider;
    f.env.AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT = expiry.cutoff;
  }
  if (invalidCutoff !== undefined)
    f.env.AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT = invalidCutoff;
  const port = await freePort();
  const helper = new URL('./onemap-secret.ts', import.meta.url).href;
  const start = new URL('./start.ts', import.meta.url).href;
  const database = new URL('../database/index.ts', import.meta.url).href;
  const provider = new URL('../routes/provider.ts', import.meta.url).href;
  const dbCode = `export function transaction(){throw new Error('Database writes forbidden')} export function createDatabase(){return {query:async()=>{console.log('synthetic_database_wait');${phase === 'during' ? 'await new Promise(()=>{setInterval(()=>{},1000)});' : 'return {rows:[]};'}},end:async()=>{console.log('synthetic_database_ended')}}}`;
  const code = `
    import fs from 'node:fs';
    import { registerHooks } from 'node:module';
    registerHooks({resolve(specifier, context, next) {
      const result = next(specifier, context);
      if (result.url === ${JSON.stringify(database)}) return {url:'data:text/javascript,'+encodeURIComponent(${JSON.stringify(dbCode)}),shortCircuit:true};
      return result;
    }});
    let providerCalls = 0;
    globalThis.fetch = async()=>{providerCalls++; throw new Error('Provider request forbidden')};
    ${expiry ? "process.once('exit',()=>console.log(JSON.stringify({event:'synthetic_provider_total',providerCalls})));" : ''}
    const { startOneMap } = await import(${JSON.stringify(helper)});
    ${phase === 'preparation' ? `const open = fs.openSync; fs.openSync = (...args) => { if(args[0] === ${JSON.stringify(f.source)}) { console.log('synthetic_prepare_signal'); process.emit(${JSON.stringify(signal)}); throw new Error('Startup must not resume'); } return open(...args); };` : ''}
    try {
      await startOneMap({source:${JSON.stringify(f.source)},temporaryBase:${JSON.stringify(f.temporaryBase)},start:async()=>{
        ${phase === 'before' ? "console.log('synthetic_before_import'); await new Promise(resolve=>setTimeout(resolve,10000));" : ''}
        ${phase === 'failure' ? "throw new Error('synthetic-sensitive-import-error');" : `await import(${JSON.stringify(start)});`}
      }});
      ${expiry ? `const {createRouteProvider} = await import(${JSON.stringify(provider)}); console.log(JSON.stringify({event:'synthetic_expired_route',result:await createRouteProvider(process.env).search(${JSON.stringify(input)}),providerCalls}));` : ''}
      console.log(JSON.stringify({event:'synthetic_handoff',pid:process.pid,provider:process.env.AMR_ROUTES_PROVIDER,termHandlers:process.listenerCount('SIGTERM'),intHandlers:process.listenerCount('SIGINT')}));
    } catch(error) { console.error(error.message); process.exit(1); }
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      AUTH_DEV_ENABLED: 'true',
      API_HOST: '127.0.0.1',
      API_PORT: String(port),
      ...f.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '',
    err = '';
  child.stdout.on('data', (chunk) => {
    out += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    err += String(chunk);
  });
  const finished = once(child, 'exit');
  const target =
    phase === 'before'
      ? 'synthetic_before_import'
      : phase === 'during'
        ? 'synthetic_database_wait'
        : 'api_started';
  try {
    if (phase !== 'failure' && phase !== 'preparation' && phase !== 'invalid') {
      const deadline = Date.now() + 10000;
      while (
        !out.includes(target) &&
        child.exitCode === null &&
        Date.now() < deadline
      )
        await new Promise((resolve) => setTimeout(resolve, 10));
      assert.ok(
        out.includes(target),
        `No expected lifecycle event: ${out} ${err}`,
      );
      if (expiry) {
        const health = await new Promise<{
          status: number | undefined;
          body: string;
        }>((resolve, reject) => {
          const request = get(`http://127.0.0.1:${port}/health`, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
              body += chunk;
            });
            response.on('error', reject);
            response.on('end', () =>
              resolve({ status: response.statusCode, body }),
            );
          });
          request.on('error', reject);
          request.setTimeout(2000, () =>
            request.destroy(new Error('Health request timed out')),
          );
        });
        assert.equal(health.status, 200);
        assert.deepEqual(JSON.parse(health.body), { status: 'ok' });
        const rejected = out
          .split('\n')
          .find((line) => line.includes('synthetic_expired_route'));
        assert.ok(rejected);
        assert.deepEqual(JSON.parse(rejected), {
          event: 'synthetic_expired_route',
          result: { kind: 'unavailable', reason: 'live_not_configured' },
          providerCalls: 0,
        });
      }
      child.kill(signal);
    }
    const [exitCode] = await Promise.race([
      finished,
      new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Child did not exit')),
          10000,
        );
        timer.unref();
      }),
    ]);
    assert.equal(
      exitCode,
      phase === 'after'
        ? 0
        : phase === 'failure' || phase === 'invalid'
          ? 1
          : signal === 'SIGTERM'
            ? 143
            : 130,
    );
    assert.deepEqual(fs.readdirSync(f.temporaryBase), []);
    assert.ok(fs.existsSync(f.source));
    if (expiry) {
      const total = out
        .split('\n')
        .find((line) => line.includes('synthetic_provider_total'));
      assert.ok(total);
      assert.deepEqual(JSON.parse(total), {
        event: 'synthetic_provider_total',
        providerCalls: 0,
      });
    }
    assert.ok(
      !out.includes('synthetic-staged-token') &&
        !err.includes('synthetic-staged-token'),
    );
    const staged = out
      .split('\n')
      .find((line) => line.includes('onemap_token_staged'));
    if (phase === 'preparation' || phase === 'invalid')
      assert.equal(staged, undefined);
    else {
      assert.ok(staged);
      const metadata = JSON.parse(staged);
      assert.equal(metadata.provider, expiry?.provider ?? 'disabled');
      assert.equal(metadata.uid, process.getuid?.());
      assert.equal(metadata.mode, 0o600);
      assert.equal(metadata.directoryMode, 0o700);
      assert.equal(metadata.nlink, 1);
      assert.equal(typeof metadata.path, 'string');
    }
    if (phase === 'after') {
      const handoff = out
        .split('\n')
        .find((line) => line.includes('synthetic_handoff'));
      assert.ok(handoff);
      assert.deepEqual(JSON.parse(handoff), {
        event: 'synthetic_handoff',
        pid: child.pid,
        provider: expiry?.provider ?? 'disabled',
        termHandlers: 1,
        intHandlers: 1,
      });
      assert.ok(out.includes('synthetic_database_ended'));
      assert.ok(out.includes(`"port":${port}`));
      assert.ok(out.includes('"host":"127.0.0.1"'));
    } else {
      assert.ok(!out.includes('api_started'));
      assert.ok(!out.includes('synthetic_handoff'));
    }
    if (phase === 'failure' || phase === 'invalid') {
      assert.match(err, /OneMap startup failed\./);
      assert.ok(!err.includes('synthetic-sensitive-import-error'));
      assert.ok(!err.includes(f.source));
    }
    const probe = createServer();
    probe.listen(port, '127.0.0.1');
    await once(probe, 'listening');
    await new Promise<void>((resolve) => probe.close(() => resolve()));
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await finished;
    }
    f.remove();
  }
}

for (const phase of ['preparation', 'before', 'during', 'after'] as const)
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    test(`${signal} ${phase} dynamic import cleans copy and cannot resume startup`, () =>
      lifecycle(phase, signal));
test('import failure is sanitized, removes copy and leaves no listener', () =>
  lifecycle('failure', 'SIGTERM'));

for (const cutoff of ['', 'not-a-timestamp'])
  test(`${cutoff ? 'malformed' : 'missing'} cutoff still fails wrapper startup`, () =>
    lifecycle('invalid', 'SIGTERM', undefined, cutoff));

for (const provider of ['disabled', 'onemap'] as const)
  for (const remaining of [-3600000, 30000])
    test(`${provider} startup remains healthy with ${remaining < 0 ? 'expired' : 'within-margin'} cutoff and no provider dispatch`, () =>
      lifecycle('after', 'SIGTERM', {
        provider,
        cutoff: new Date(Date.now() + remaining).toISOString(),
      }));
