import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { namespaceFor } from '../../scripts/local-db.mjs';
import { ensureAccount } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';
import { createSession } from '../auth/session.ts';
import { createApi } from '../api/app.ts';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { createJourneyService } from '../journeys/store.ts';
import { createAwardsHandler } from './http.ts';
import { awardRoute } from './testing/fixtures.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${namespaceFor(fileURLToPath(new URL('../../', import.meta.url)))}_test`
)
  throw new Error('Use only the allocated awards worktree test database.');
const pool = createDatabase();
before(() => migrate(pool));
after(() => pool.end());

async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
async function prepared() {
  const account = await ensureAccount(pool, {
    issuer: 'urn:amr:awards-http-test',
    subject: randomUUID(),
  });
  const profile = account.profiles.find((p) => p.kind === 'real');
  assert.ok(profile);
  const token = (await createSession(pool, account.id)).token;
  let now = Date.now();
  const journeys = createJourneyService({
    pool,
    env: { NODE_ENV: 'test', JOURNEY_FIXTURES_ENABLED: 'true' },
    clock: () => now,
  });
  const journey = await journeys.prepare(
    token,
    { profileId: profile.id, requestId: randomUUID() },
    awardRoute(2.419, now),
  );
  const captureSessionId = randomUUID();
  await journeys.start(token, journey.id, {
    requestId: randomUUID(),
    captureSessionId,
  });
  const samples = Array.from({ length: 6 }, (_, index) => ({
    id: randomUUID(),
    acquiredAtMs: now + index * 60000,
    receivedAtMs: now + index * 60000,
    latitude: 1.3 + index * 0.002,
    longitude: 103.8,
    accuracyMeters: 5,
    context: 'background',
    mocked: false,
  }));
  now += 300000;
  await journeys.appendEvidence(token, journey.id, {
    requestId: randomUUID(),
    captureSessionId,
    samples,
  });
  const completed = await journeys.finish(token, journey.id, {
    requestId: randomUUID(),
    captureSessionId,
    endedAtMs: now,
    reason: 'arrival',
  });
  return {
    token,
    journeyId: journey.id,
    input: {
      profileId: profile.id,
      requestId: randomUUID(),
      assessmentVersion: completed.assessment.version,
      assessmentRevision: completed.assessment.revision,
    },
  };
}

test('owned HTTP handler uses current sessions and trusted PG calculations without a credit bypass', async (t) => {
  const f = await prepared();
  const handler = createAwardsHandler({ pool });
  let reads = 0;
  assert.equal(
    await handler({
      method: 'DELETE',
      path: `/v1/journeys/${f.journeyId}/award`,
      token: f.token,
      readBody: async () => {
        reads++;
        return {};
      },
    }),
    null,
  );
  assert.equal(reads, 0);
  // This bounded fixture supplies the API owner's existing transport duties.
  // The owned handler receives no alternate authority or accounting callback.
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const authorization = req.headers.authorization;
      if (!authorization?.startsWith('Bearer '))
        throw new ApiError(401, 'Sign in again.');
      const result = await handler({
        method: req.method,
        path: new URL(req.url ?? '/', 'http://api.invalid').pathname,
        token: authorization.slice(7),
        readBody: async () => {
          if (req.headers['content-type'] !== 'application/json')
            throw new ApiError(415, 'Use application/json.');
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            const part = Buffer.from(chunk);
            size += part.length;
            if (size > 4096) throw new ApiError(413, 'Request is too large.');
            chunks.push(part);
          }
          try {
            return JSON.parse(Buffer.concat(chunks).toString());
          } catch {
            throw new ApiError(400, 'Invalid JSON.');
          }
        },
      });
      res.statusCode = result?.status ?? 404;
      res.end(JSON.stringify(result?.body ?? { error: 'Not found.' }));
    } catch (error) {
      res.statusCode = error instanceof ApiError ? error.status : 500;
      res.end(
        JSON.stringify({
          error: error instanceof ApiError ? error.message : 'Request failed.',
        }),
      );
    }
  });
  const base = await listen(server);
  const path = `/v1/journeys/${f.journeyId}/settlements`;
  const post = (value: unknown, token = f.token) =>
    fetch(base + path, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(value),
    });
  try {
    const start = performance.now();
    const response = await post(f.input);
    assert.equal(response.status, 200);
    const text = await response.text();
    const value = JSON.parse(text);
    assert.equal(value.entry.delta, 0);
    assert.equal(value.outcome.targetPoints, 120);
    assert.equal(value.outcome.creditContext, 'production_unavailable');
    assert.equal(
      value.outcome.receipt.assessment.status,
      'satisfies_configured_rules',
    );
    assert.equal(
      value.outcome.receipt.result.productionCredit.kind,
      'unavailable',
    );
    assert.doesNotMatch(
      text,
      /latitude|longitude|coordinates|captureSessionId|token_hash/,
    );
    t.diagnostic(
      `one local synthetic calculation request: ${Buffer.byteLength(text)} response bytes, ${(performance.now() - start).toFixed(1)} ms; no production latency claim`,
    );
    assert.deepEqual(await (await post(f.input)).json(), value);
    const read = await fetch(base + `/v1/journeys/${f.journeyId}/award`, {
      headers: { authorization: `Bearer ${f.token}` },
    });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).cumulativeAutomaticCredit, 0);
    for (const field of [
      'amount',
      'factor',
      'actor',
      'badge',
      'projection',
      'synthetic',
      'creditContext',
    ])
      assert.equal(
        (await post({ ...f.input, requestId: randomUUID(), [field]: true }))
          .status,
        400,
      );
    assert.equal((await post(f.input, 'invalid')).status, 401);
    assert.equal((await fetch(base + path, { method: 'POST' })).status, 401);
    const other = await prepared();
    assert.equal((await post(f.input, other.token)).status, 404);
    assert.equal(
      (
        await fetch(base + path, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${f.token}`,
            'content-type': 'text/plain',
          },
          body: '{}',
        })
      ).status,
      415,
    );
    assert.equal(
      (await post({ ...f.input, extra: 'x'.repeat(4100) })).status,
      413,
    );
  } finally {
    await close(server);
  }
});

test('shared createApi remains unregistered until the separate root handoff', async () => {
  const f = await prepared();
  const server = createApi({
    pool,
    env: { NODE_ENV: 'test', AUTH_DEV_ENABLED: 'true', API_HOST: '127.0.0.1' },
  });
  const base = await listen(server);
  try {
    for (const [method, suffix] of [
      ['GET', 'award'],
      ['POST', 'settlements'],
    ]) {
      const response = await fetch(
        `${base}/v1/journeys/${f.journeyId}/${suffix}`,
        { method, headers: { authorization: `Bearer ${f.token}` } },
      );
      assert.equal(response.status, 404);
    }
  } finally {
    await close(server);
  }
});
