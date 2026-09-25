import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { connect } from 'node:net';
import { after, before, test, type TestContext } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { namespaceFor } from '../../../scripts/local-db.mjs';
import { createDatabase } from '../../database/index.ts';
import { migrate } from '../../database/migrate.ts';
import { ensureAccount } from '../../accounts/store.ts';
import { createSession, revokeSession } from '../../auth/session.ts';
import { createJourneyService } from '../../journeys/store.ts';
import { summarySchema } from '../../journeys/contracts.ts';
import { historyEntry } from '../../points/contracts.ts';
import { outcomeSchema, receiptSchema } from '../contracts.ts';
import { awardRoute } from './fixtures.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${namespaceFor(fileURLToPath(new URL('../../../', import.meta.url)))}_test`
)
  throw new Error('Use only the allocated awards worktree test database.');
const pool = createDatabase();
before(() => migrate(pool));
after(async () => {
  await pool.end();
  process.stdout.write(
    JSON.stringify({
      event: 'pool_closed',
      pid: process.pid,
      resource: 'awards_registered_api_parent',
    }) + '\n',
  );
});
const resultSchema = z.object({ entry: historyEntry, outcome: outcomeSchema });
const readSchema = z.object({
  latestReceipt: receiptSchema.nullable(),
  currentAssessmentIdentity: receiptSchema.shape.assessmentIdentity,
  cumulativeAutomaticCredit: z.number(),
});

async function fixture(missing = false) {
  const account = await ensureAccount(pool, {
    issuer: 'urn:amr:awards-registered-test',
    subject: randomUUID(),
  });
  const profile = account.profiles.find((item) => item.kind === 'real');
  assert.ok(profile);
  const token = (await createSession(pool, account.id)).token;
  let now = Date.now() - 360000;
  const journeys = createJourneyService({
    pool,
    env: { NODE_ENV: 'test', JOURNEY_FIXTURES_ENABLED: 'true' },
    clock: () => now,
  });
  const prepared = await journeys.prepare(
    token,
    { profileId: profile.id, requestId: randomUUID() },
    awardRoute(2.419, now),
  );
  const captureSessionId = randomUUID();
  await journeys.start(token, prepared.id, {
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
  await journeys.appendEvidence(token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
    samples: missing ? [samples[0], samples[5]] : samples,
  });
  const finished = await journeys.finish(token, prepared.id, {
    requestId: randomUUID(),
    captureSessionId,
    endedAtMs: now,
    reason: 'arrival',
  });
  return {
    account,
    profile,
    token,
    journeyId: prepared.id,
    captureSessionId,
    samples,
    input: {
      profileId: profile.id,
      requestId: randomUUID(),
      assessmentVersion: finished.assessment.version,
      assessmentRevision: finished.assessment.revision,
    },
  };
}
async function api(t: TestContext) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('./api-process.ts', import.meta.url))],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const exited = once(child, 'exit');
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    child.kill('SIGTERM');
    const [code, signal] = await exited;
    stopped = true;
    assert.equal(code, 0, stderr);
    assert.equal(signal, null);
    const lines = stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.ok(
      lines.some(
        (line) =>
          line.event === 'closed' &&
          line.listener === true &&
          line.pool === true,
      ),
    );
    t.diagnostic(
      JSON.stringify({
        event: 'api_closed',
        pid: child.pid,
        listener: true,
        pool: true,
        exitCode: code,
      }),
    );
  };
  t.after(stop);
  for (let attempt = 0; attempt < 200 && !stdout.includes('\n'); attempt++) {
    if (child.exitCode !== null) assert.fail('API startup failed: ' + stderr);
    await setTimeout(10);
  }
  const ready = z
    .object({
      event: z.literal('listening'),
      pid: z.number().int(),
      port: z.number().int().positive(),
    })
    .parse(JSON.parse(stdout.split('\n')[0]));
  t.diagnostic(JSON.stringify(ready));
  const base = `http://127.0.0.1:${ready.port}`;
  async function request(
    path: string,
    token?: string,
    input?: unknown,
    extras: RequestInit = {},
  ) {
    return fetch(base + path, {
      method: input === undefined ? 'GET' : 'POST',
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'content-type': 'application/json',
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      ...extras,
    });
  }
  return { request, stop, port: ready.port, pid: ready.pid };
}
async function closedPort(port: number) {
  const socket = connect({ host: '127.0.0.1', port });
  try {
    const [error] = await once(socket, 'error');
    assert.equal(error.code, 'ECONNREFUSED');
  } finally {
    socket.destroy();
  }
}
async function waitForBlocker(pid: number) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const rows = await pool.query(
      'SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))',
      [pid],
    );
    if (rows.rowCount) return;
    await setTimeout(10);
  }
  assert.fail('Expected an observed own-database lock wait.');
}

test('registered API retains fallback/full revisions, concurrent no-op credit, stale-key denial and exact restart replay', async (t) => {
  const f = await fixture(true);
  const first = await api(t);
  const settlement = `/v1/journeys/${f.journeyId}/settlements`;
  const readPath = `/v1/journeys/${f.journeyId}/award`;
  const fallbackResponse = await first.request(settlement, f.token, f.input);
  assert.equal(fallbackResponse.status, 200);
  const fallback = resultSchema.parse(await fallbackResponse.json());
  assert.equal(fallback.outcome.targetPoints, 50);
  assert.equal(fallback.entry.delta, 0);
  assert.equal(fallback.outcome.creditContext, 'production_unavailable');
  const evidenceResponse = await first.request(
    `/v1/journeys/${f.journeyId}/evidence`,
    f.token,
    {
      requestId: randomUUID(),
      captureSessionId: f.captureSessionId,
      samples: f.samples.slice(1, 5),
    },
  );
  assert.equal(evidenceResponse.status, 200);
  const latest = summarySchema.parse(await evidenceResponse.json());
  assert.equal(latest.assessment.status, 'satisfies_configured_rules');
  const before = await pool.query(
    'SELECT count(*)::int AS count FROM app.points_operations WHERE profile_id=$1',
    [f.profile.id],
  );
  const pending = readSchema.parse(
    await (await first.request(readPath, f.token)).json(),
  );
  assert.equal(
    pending.latestReceipt?.assessmentIdentity.revision,
    f.input.assessmentRevision,
  );
  assert.equal(
    pending.currentAssessmentIdentity.revision,
    latest.assessment.revision,
  );
  assert.ok(
    pending.currentAssessmentIdentity.revision > f.input.assessmentRevision,
  );
  assert.deepEqual(
    await pool
      .query(
        'SELECT count(*)::int AS count FROM app.points_operations WHERE profile_id=$1',
        [f.profile.id],
      )
      .then((r) => r.rows),
    before.rows,
    'GET cannot settle a newer revision',
  );
  const input = {
    ...f.input,
    requestId: randomUUID(),
    assessmentRevision: latest.assessment.revision,
  };
  const responses = await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      first.request(settlement, f.token, {
        ...input,
        requestId: index < 2 ? input.requestId : randomUUID(),
      }),
    ),
  );
  const results = await Promise.all(
    responses.map(async (response) => {
      assert.equal(response.status, 200);
      return resultSchema.parse(await response.json());
    }),
  );
  assert.deepEqual(results[0], results[1]);
  assert.ok(
    results.every(
      (value) =>
        value.entry.delta === 0 &&
        value.outcome.targetPoints === 120 &&
        value.outcome.cumulativeAutomaticCredit === 0,
    ),
  );
  assert.deepEqual(
    await (await first.request(settlement, f.token, f.input)).json(),
    fallback,
  );
  assert.equal(
    (
      await first.request(settlement, f.token, {
        ...f.input,
        requestId: randomUUID(),
      })
    ).status,
    409,
  );
  await first.stop();
  await closedPort(first.port);
  t.diagnostic(
    JSON.stringify({ event: 'port_closed', pid: first.pid, port: first.port }),
  );
  const second = await api(t);
  assert.deepEqual(
    await (await second.request(settlement, f.token, f.input)).json(),
    fallback,
  );
  assert.deepEqual(
    await (await second.request(settlement, f.token, input)).json(),
    results[0],
  );
  const history = await (
    await second.request(`/v1/profiles/${f.profile.id}/points/history`, f.token)
  ).json();
  assert.equal(history.balance, 0);
  assert.equal(history.entries.length, 6);
  const read = readSchema.parse(
    await (await second.request(readPath, f.token)).json(),
  );
  assert.equal(
    read.latestReceipt?.assessmentIdentity.revision,
    latest.assessment.revision,
  );
});

test('registered API rejects current-session, ownership, forged authority, origin/body/method and bounded rate errors', async (t) => {
  const f = await fixture();
  const other = await fixture();
  const server = await api(t);
  const path = `/v1/journeys/${f.journeyId}/settlements`;
  assert.equal((await server.request(path, f.token, f.input)).status, 200);
  assert.equal((await server.request(path, undefined, f.input)).status, 401);
  assert.equal((await server.request(path, other.token, f.input)).status, 404);
  assert.equal(
    (await server.request(`/v1/journeys/${f.journeyId}/award`, other.token))
      .status,
    404,
  );
  for (const field of [
    'amount',
    'actor',
    'projection',
    'ready',
    'calibration',
    'syntheticTest',
    'creditContext',
  ])
    assert.equal(
      (await server.request(path, f.token, { ...f.input, [field]: true }))
        .status,
      400,
    );
  const headers = {
    authorization: `Bearer ${f.token}`,
    'content-type': 'application/json',
  };
  assert.equal(
    (
      await server.request(path, f.token, f.input, {
        headers: { ...headers, origin: 'https://foreign.invalid' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await server.request(path, f.token, f.input, {
        headers: { ...headers, 'content-type': 'text/plain' },
      })
    ).status,
    415,
  );
  assert.equal(
    (await server.request(path, f.token, f.input, { body: '{' })).status,
    400,
  );
  assert.equal(
    (await server.request(path, f.token, { oversized: 'x'.repeat(4100) }))
      .status,
    413,
  );
  assert.equal(
    (await server.request(path, f.token, undefined, { method: 'DELETE' }))
      .status,
    404,
  );
  await revokeSession(pool, f.token);
  assert.equal(
    (await server.request(path, f.token, f.input)).status,
    401,
    'current authorization precedes successful replay',
  );
  let response;
  for (let count = 0; count < 301; count++) {
    response = await server.request(
      `/v1/journeys/${f.journeyId}/award`,
      other.token,
    );
    if (response.status === 429) break;
  }
  assert.equal(response?.status, 429);
});

test('registered HTTP callback failure rolls back receipt/state/History/balance and unchanged retry succeeds', async (t) => {
  const f = await fixture();
  const server = await api(t);
  const path = `/v1/journeys/${f.journeyId}/settlements`;
  // Test-owned failure point after the receipt insert. Transaction-scoped setting
  // is avoided because HTTP uses another real connection; match only this fixture.
  const constraint = 'awards_test_' + randomUUID().replaceAll('-', '');
  await pool.query(
    `ALTER TABLE app.journey_award_state ADD CONSTRAINT ${constraint} CHECK (journey_id <> '${f.journeyId}')`,
  );
  try {
    const response = await server.request(path, f.token, f.input);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: 'The request could not be completed.',
    });
    for (const table of ['journey_award_assessments', 'journey_award_state'])
      assert.equal(
        (
          await pool.query(
            `SELECT count(*)::int AS count FROM app.${table} WHERE journey_id=$1`,
            [f.journeyId],
          )
        ).rows[0].count,
        0,
      );
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM app.points_operations WHERE profile_id=$1',
          [f.profile.id],
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (
        await pool.query('SELECT balance FROM app.profiles WHERE id=$1', [
          f.profile.id,
        ])
      ).rows[0].balance,
      0,
    );
  } finally {
    await pool.query(
      `ALTER TABLE app.journey_award_state DROP CONSTRAINT ${constraint}`,
    );
  }
  assert.equal((await server.request(path, f.token, f.input)).status, 200);
});

test('registered API observes real journey and session lock waits before retaining or replaying outcomes', async (t) => {
  const f = await fixture();
  const server = await api(t);
  const path = `/v1/journeys/${f.journeyId}/settlements`;
  const blocker = await pool.connect();
  const pid = (
    await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
  ).rows[0].pid;
  let pending: Promise<Response> | undefined;
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM app.journeys WHERE id=$1 FOR UPDATE', [
      f.journeyId,
    ]);
    pending = server.request(path, f.token, f.input);
    await waitForBlocker(pid);
    await blocker.query('COMMIT');
    assert.equal((await pending).status, 200);
    const hash = createHash('sha256').update(f.token).digest('hex');
    await pool.query(
      "UPDATE app.sessions SET expires_at=clock_timestamp()+interval '0.5 seconds' WHERE token_hash=$1",
      [hash],
    );
    await blocker.query('BEGIN');
    await blocker.query(
      'SELECT token_hash FROM app.sessions WHERE token_hash=$1 FOR UPDATE',
      [hash],
    );
    pending = server.request(path, f.token, f.input);
    await waitForBlocker(pid);
    await setTimeout(550);
    await blocker.query('COMMIT');
    assert.equal((await pending).status, 401);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    await pending?.catch(() => {});
  }
});
