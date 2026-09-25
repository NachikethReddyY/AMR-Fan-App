import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { assignRole, ensureAccount } from '../accounts/store.ts';
import { createSession, revokeSession } from '../auth/session.ts';
import { adjustPoints, readPointsHistory } from '../points/index.ts';
import {
  createSubmission,
  listOwnSubmissions,
  listAdminSubmissions,
  moderateSubmission,
} from './index.ts';
import { ApiError } from '../accounts/types.ts';
import { createApi } from '../api/app.ts';
import { handleSubmissionRequest } from './http.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use this worktree disposable test database.');

const pool = createDatabase();
const issuer = `urn:amr:submissions-test:${randomUUID()}`;
async function account(subject: string, admin = false) {
  const value = await ensureAccount(pool, { issuer, subject });
  if (admin)
    await assignRole(pool, value.id, 'admin', 'Synthetic submission test');
  const session = await createSession(pool, value.id);
  const real = value.profiles.find((profile) => profile.kind === 'real');
  const demo = value.profiles.find((profile) => profile.kind === 'demo');
  assert.ok(real && demo);
  return { ...value, token: session.token, real, demo };
}
before(() => migrate(pool));
after(() => pool.end());

test('a fan with 600 points submits once, retains 100 and sees a persistent pending submission linked to History', async () => {
  const admin = await account('admin', true);
  const fan = await account('fan');
  await adjustPoints(pool, admin.token, {
    targetProfileId: fan.real.id,
    requestId: randomUUID(),
    delta: 600,
    reason: 'Synthetic submission allowance',
  });
  const input = {
    requestId: randomUUID(),
    text: 'What inspires your race preparation?',
    tag: 'question',
    confirmedFee: 500,
  };
  const result = await createSubmission(pool, fan.token, fan.real.id, input);
  assert.equal(result.entry.delta, -500);
  assert.equal(result.entry.balanceAfter, 100);
  assert.equal(result.outcome.status, 'pending');
  assert.equal(result.outcome.rankingPoints, 0);
  assert.equal(result.outcome.pointsOperationId, result.entry.id);
  assert.equal(result.outcome.ownerProfileId, fan.real.id);
  const page = await listOwnSubmissions(pool, fan.token, fan.real.id);
  assert.deepEqual(page.submissions, [result.outcome]);
  const history = await readPointsHistory(pool, fan.token, fan.real.id);
  assert.equal(history.balance, 100);
  assert.equal(history.entries.length, 2);
  assert.deepEqual(history.entries[0], result.entry);
  assert.deepEqual(
    await createSubmission(pool, fan.token, fan.real.id, input),
    result,
  );
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).entries.length,
    2,
  );
});

const status = (expected: number) => (error: unknown) =>
  error instanceof ApiError && error.status === expected;
async function grant(token: string, profileId: string, delta: number) {
  return adjustPoints(pool, token, {
    targetProfileId: profileId,
    requestId: randomUUID(),
    delta,
    reason: 'Synthetic submission allowance',
  });
}
const intent = (text = 'A fan suggestion') => ({
  requestId: randomUUID(),
  text,
  confirmedFee: 500,
});

test('concurrent retries charge once and concurrent new submissions cannot overspend', async () => {
  const admin = await account('concurrency-admin', true);
  const fan = await account('concurrency-fan');
  await grant(admin.token, fan.real.id, 600);
  const input = intent();
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      createSubmission(pool, fan.token, fan.real.id, input),
    ),
  );
  for (const result of results) assert.deepEqual(result, results[0]);
  assert.equal(
    (await listOwnSubmissions(pool, fan.token, fan.real.id)).submissions.length,
    1,
  );
  await assert.rejects(
    createSubmission(pool, fan.token, fan.real.id, {
      ...input,
      text: 'Different action',
    }),
    status(409),
  );
  await assert.rejects(
    createSubmission(pool, fan.token, fan.demo.id, input),
    status(409),
  );
  await grant(admin.token, fan.real.id, 500);
  const competing = await Promise.allSettled([
    createSubmission(pool, fan.token, fan.real.id, intent('Question')),
    createSubmission(pool, fan.token, fan.real.id, intent('Activity')),
  ]);
  assert.equal(
    competing.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    competing.filter(
      (result) => result.status === 'rejected' && status(409)(result.reason),
    ).length,
    1,
  );
  const history = await readPointsHistory(pool, fan.token, fan.real.id);
  assert.equal(history.balance, 100);
  assert.equal(
    history.entries.filter((entry) => entry.kind === 'fan_submission').length,
    2,
  );
  assert.equal(
    (await listOwnSubmissions(pool, fan.token, fan.real.id)).submissions.length,
    2,
  );
});

test('unaffordable submissions roll back both content and debit; foreign owners and anonymous callers cannot read or spend', async () => {
  const fan = await account('unaffordable-fan');
  const stranger = await account('stranger');
  await assert.rejects(
    createSubmission(pool, fan.token, fan.real.id, intent()),
    status(409),
  );
  assert.deepEqual(
    (await listOwnSubmissions(pool, fan.token, fan.real.id)).submissions,
    [],
  );
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).entries.length,
    0,
  );
  await assert.rejects(
    createSubmission(pool, stranger.token, fan.real.id, intent()),
    status(404),
  );
  await assert.rejects(
    listOwnSubmissions(pool, stranger.token, fan.real.id),
    status(404),
  );
  await assert.rejects(
    createSubmission(pool, '', fan.real.id, intent()),
    status(401),
  );
  await assert.rejects(listOwnSubmissions(pool, '', fan.real.id), status(401));
});

test('only a current assigned admin can approve a pending submission and the owner sees status without rewriting the fee', async () => {
  const admin = await account('moderation-admin', true);
  const fan = await account('moderation-fan');
  await grant(admin.token, fan.real.id, 600);
  const original = await createSubmission(
    pool,
    fan.token,
    fan.real.id,
    intent(),
  );
  const id = original.outcome.id;
  const decision = { requestId: randomUUID(), status: 'approved' };
  await assert.rejects(
    moderateSubmission(pool, fan.token, id, decision),
    status(403),
  );
  await assert.rejects(listAdminSubmissions(pool, fan.token), status(403));
  assert.ok(
    (await listAdminSubmissions(pool, admin.token)).submissions.some(
      (row) => row.id === id,
    ),
  );
  const approved = await moderateSubmission(pool, admin.token, id, decision);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.moderatedBy, admin.id);
  assert.ok(
    approved.moderatedAt && Number.isFinite(Date.parse(approved.moderatedAt)),
  );
  assert.equal(approved.rankingPoints, 0);
  assert.deepEqual(
    (await listOwnSubmissions(pool, fan.token, fan.real.id)).submissions,
    [approved],
  );
  const history = await readPointsHistory(pool, fan.token, fan.real.id);
  assert.equal(history.balance, 100);
  assert.deepEqual(history.entries[0], original.entry);
  assert.deepEqual(
    await moderateSubmission(pool, admin.token, id, decision),
    approved,
  );
  await assert.rejects(
    moderateSubmission(pool, admin.token, id, {
      ...decision,
      status: 'rejected',
    }),
    status(409),
  );
  await assert.rejects(
    moderateSubmission(pool, admin.token, id, {
      requestId: randomUUID(),
      status: 'rejected',
    }),
    status(409),
  );
});

test('competing admin decisions serialize, and role or session revocation denies reads, decisions and replays', async () => {
  const first = await account('race-admin-a', true);
  const second = await account('race-admin-b', true);
  const fan = await account('race-fan');
  await grant(first.token, fan.real.id, 1000);
  const one = await createSubmission(
    pool,
    fan.token,
    fan.real.id,
    intent('First'),
  );
  const two = await createSubmission(
    pool,
    fan.token,
    fan.real.id,
    intent('Second'),
  );
  const approved = { requestId: randomUUID(), status: 'approved' };
  const rejected = { requestId: randomUUID(), status: 'rejected' };
  const results = await Promise.allSettled([
    moderateSubmission(pool, first.token, one.outcome.id, approved),
    moderateSubmission(pool, second.token, one.outcome.id, rejected),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    results.filter(
      (result) => result.status === 'rejected' && status(409)(result.reason),
    ).length,
    1,
  );
  const winner = results[0].status === 'fulfilled' ? first : second;
  const decision = results[0].status === 'fulfilled' ? approved : rejected;
  await assert.rejects(
    moderateSubmission(pool, winner.token, two.outcome.id, decision),
    status(409),
  );
  await assignRole(pool, winner.id, 'fan', 'Synthetic revocation');
  await assert.rejects(listAdminSubmissions(pool, winner.token), status(403));
  await assert.rejects(
    moderateSubmission(pool, winner.token, one.outcome.id, decision),
    status(403),
  );
  await assert.rejects(
    moderateSubmission(pool, winner.token, two.outcome.id, {
      requestId: randomUUID(),
      status: 'approved',
    }),
    status(403),
  );
  await assignRole(pool, winner.id, 'admin', 'Synthetic restore');
  await revokeSession(pool, winner.token);
  await assert.rejects(listAdminSubmissions(pool, winner.token), status(401));
  await assert.rejects(
    moderateSubmission(pool, winner.token, one.outcome.id, decision),
    status(401),
  );
  await revokeSession(pool, fan.token);
  await assert.rejects(
    listOwnSubmissions(pool, fan.token, fan.real.id),
    status(401),
  );
});

test('a role revoked during initial authentication cannot approve while waiting for current authority', async () => {
  const admin = await account('locked-revocation-admin', true);
  const fan = await account('locked-revocation-fan');
  await grant(admin.token, fan.real.id, 600);
  const created = await createSubmission(
    pool,
    fan.token,
    fan.real.id,
    intent(),
  );
  const blocker = await pool.connect();
  let result: Promise<{ ok: boolean; error?: unknown }> | undefined;
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      "UPDATE app.principals SET role = 'fan' WHERE id = $1",
      [admin.id],
    );
    result = moderateSubmission(pool, admin.token, created.outcome.id, {
      requestId: randomUUID(),
      status: 'approved',
    }).then(
      () => ({ ok: true }),
      (error: unknown) => ({ ok: false, error }),
    );
    let waiting = false;
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      const locks = await pool.query<{ waiting: boolean }>(`SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
        AND wait_event_type = 'Lock' AND query LIKE 'SELECT role FROM app.principals%'
      ) AS waiting`);
      waiting = locks.rows[0].waiting;
      if (!waiting) await delay(10);
    }
    assert.equal(
      waiting,
      true,
      'Moderation must wait for the current principal role lock.',
    );
    await blocker.query('COMMIT');
    const completed = await result;
    assert.equal(completed.ok, false);
    assert.ok(status(403)(completed.error));
    assert.equal(
      (await listOwnSubmissions(pool, fan.token, fan.real.id)).submissions[0]
        .status,
      'pending',
    );
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    if (result) await result;
  }
});

test('rejection retains its fee and immutable history; a confirmed resubmission is a new paid record', async () => {
  const admin = await account('reject-admin', true);
  const fan = await account('reject-fan');
  const stranger = await account('reject-stranger');
  await grant(admin.token, fan.real.id, 1100);
  const input = intent('Original proposal');
  const original = await createSubmission(pool, fan.token, fan.real.id, input);
  await assert.rejects(
    createSubmission(pool, fan.token, fan.real.id, {
      ...intent(),
      resubmissionOf: original.outcome.id,
    }),
    status(409),
  );
  const rejected = await moderateSubmission(
    pool,
    admin.token,
    original.outcome.id,
    { requestId: randomUUID(), status: 'rejected' },
  );
  assert.deepEqual(
    await createSubmission(pool, fan.token, fan.real.id, input),
    original,
  );
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).balance,
    600,
  );
  await assert.rejects(
    createSubmission(pool, stranger.token, stranger.real.id, {
      ...intent(),
      resubmissionOf: original.outcome.id,
    }),
    status(404),
  );
  await assert.rejects(
    createSubmission(pool, fan.token, fan.real.id, {
      ...intent(),
      confirmedFee: 0,
      resubmissionOf: original.outcome.id,
    }),
    status(400),
  );
  const retry = await createSubmission(pool, fan.token, fan.real.id, {
    ...intent('Revised proposal'),
    resubmissionOf: original.outcome.id,
  });
  assert.notEqual(retry.outcome.id, original.outcome.id);
  assert.equal(retry.entry.balanceAfter, 100);
  assert.equal(retry.entry.delta, -500);
  assert.equal(retry.outcome.status, 'pending');
  const own = await listOwnSubmissions(pool, fan.token, fan.real.id);
  assert.deepEqual(own.submissions, [retry.outcome, rejected]);
  assert.equal(
    (await readPointsHistory(pool, fan.token, fan.real.id)).entries.filter(
      (entry) => entry.kind === 'fan_submission',
    ).length,
    2,
  );
});

test('real and persistent demo profiles keep separate balances, submissions and owner pagination', async () => {
  const admin = await account('demo-admin', true);
  const fan = await account('demo-fan');
  await grant(admin.token, fan.real.id, 600);
  await grant(admin.token, fan.demo.id, 1000);
  const real = await createSubmission(
    pool,
    fan.token,
    fan.real.id,
    intent('Real profile question'),
  );
  const demoFirst = await createSubmission(
    pool,
    fan.token,
    fan.demo.id,
    intent('Demo question'),
  );
  const demoSecond = await createSubmission(
    pool,
    fan.token,
    fan.demo.id,
    intent('Demo activity'),
  );
  const resumed = await account('demo-fan');
  assert.equal(resumed.demo.id, fan.demo.id);
  assert.equal(resumed.real.id, fan.real.id);
  assert.equal(
    (await readPointsHistory(pool, resumed.token, resumed.real.id)).balance,
    100,
  );
  assert.equal(
    (await readPointsHistory(pool, resumed.token, resumed.demo.id)).balance,
    0,
  );
  assert.deepEqual(
    (await listOwnSubmissions(pool, resumed.token, resumed.real.id))
      .submissions,
    [real.outcome],
  );
  const page = await listOwnSubmissions(pool, resumed.token, resumed.demo.id, {
    limit: 1,
  });
  assert.deepEqual(page.submissions, [demoSecond.outcome]);
  assert.equal(page.nextCursor, demoSecond.outcome.sequence);
  const next = await listOwnSubmissions(pool, resumed.token, resumed.demo.id, {
    limit: 1,
    before: page.nextCursor,
  });
  assert.deepEqual(next.submissions, [demoFirst.outcome]);
  assert.equal(next.nextCursor, null);
  for (const query of [
    { limit: 0 },
    { limit: 101 },
    { before: '-1' },
    { before: '9'.repeat(20) },
    { owner: fan.real.id },
  ])
    await assert.rejects(
      listOwnSubmissions(pool, resumed.token, resumed.demo.id, query),
      status(400),
    );
});

test('the real API registers the fan-to-admin-to-fan submission path', async () => {
  const server = createApi({
    pool,
    env: { NODE_ENV: 'test', AUTH_DEV_ENABLED: 'true', API_HOST: '127.0.0.1' },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const admin = await account('http-admin', true);
    const fan = await account('http-fan');
    await grant(admin.token, fan.real.id, 600);
    const response = await fetch(
      `http://127.0.0.1:${address.port}/v1/profiles/${fan.real.id}/submissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${fan.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(intent()),
      },
    );
    assert.equal(response.status, 201);
    const result = await response.json();
    const base = `http://127.0.0.1:${address.port}`;
    const request = (
      path: string,
      token: string,
      method = 'GET',
      value?: unknown,
    ) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(value === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
        },
        body: value === undefined ? undefined : JSON.stringify(value),
      });
    const ownerPath = `/v1/profiles/${fan.real.id}/submissions`;
    const decisionPath = `/v1/admin/submissions/${result.outcome.id}/decision`;
    assert.equal((await request(ownerPath, admin.token)).status, 404);
    assert.equal((await request(ownerPath, '')).status, 401);
    assert.equal(
      (await request('/v1/admin/submissions', fan.token)).status,
      403,
    );
    assert.equal(
      (
        await request(decisionPath, fan.token, 'POST', {
          requestId: randomUUID(),
          status: 'approved',
        })
      ).status,
      403,
    );
    const queue = await request('/v1/admin/submissions', admin.token);
    assert.equal(queue.status, 200);
    assert.ok(
      (await queue.json()).submissions.some(
        (row: { id: string }) => row.id === result.outcome.id,
      ),
    );
    const decision = { requestId: randomUUID(), status: 'approved' };
    assert.equal(
      (await request(decisionPath, admin.token, 'POST', decision)).status,
      200,
    );
    assert.equal(
      (await request(decisionPath, admin.token, 'POST', decision)).status,
      200,
    );
    assert.equal(
      (await (await request(ownerPath, fan.token)).json()).submissions[0]
        .status,
      'approved',
    );
    const history = await request(
      `/v1/profiles/${fan.real.id}/points/history`,
      fan.token,
    );
    assert.equal((await history.json()).balance, 100);
    assert.equal((await request(ownerPath, fan.token, 'DELETE')).status, 405);
    assert.equal(
      (
        await request(ownerPath, fan.token, 'POST', {
          ...intent(),
          role: 'admin',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(ownerPath, fan.token, 'POST', {
          ...intent(),
          text: 'x'.repeat(5000),
        })
      ).status,
      413,
    );
    const malformed = await fetch(`${base}${ownerPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fan.token}`,
        'Content-Type': 'application/json',
      },
      body: '{',
    });
    assert.equal(malformed.status, 400);
    const upload = await fetch(`${base}${ownerPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fan.token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: 'upload',
    });
    assert.equal(upload.status, 415);
    const foreignOrigin = await fetch(`${base}${ownerPath}`, {
      headers: {
        Authorization: `Bearer ${fan.token}`,
        Origin: 'https://untrusted.example.test',
      },
    });
    assert.equal(foreignOrigin.status, 403);
    for (const path of [
      '/v1/submissions/votes',
      '/v1/admin/submissions/selections',
    ])
      assert.equal((await request(path, admin.token, 'POST', {})).status, 404);
    const page = await fetch(`${base}/admin/submissions/`);
    assert.equal(page.status, 200);
    assert.match(
      page.headers.get('content-security-policy') ?? '',
      /script-src 'self'/,
    );
    assert.match(await page.text(), /Submission review/);
    assert.equal((await fetch(`${base}/admin/submissions/app.js`)).status, 200);
    assert.equal((await fetch(`${base}/admin/style.css`)).status, 200);
    await assignRole(pool, admin.id, 'fan', 'Synthetic HTTP revocation');
    assert.equal(
      (await request('/v1/admin/submissions', admin.token)).status,
      403,
    );
    assert.equal(
      (await request(decisionPath, admin.token, 'POST', decision)).status,
      403,
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('submission identity, moderation and original debit survive actual API process shutdown and restart', async () => {
  const admin = await account('restart-admin', true);
  const fan = await account('restart-fan');
  await grant(admin.token, fan.demo.id, 600);
  async function start() {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('./testing/api-process.ts', import.meta.url))],
      { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const port = await new Promise<number>((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Test API startup timed out.'));
      }, 5000);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Test API exited ${code}.`));
      });
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        if (/^\d+\n$/.test(output)) {
          clearTimeout(timer);
          resolve(Number(output.trim()));
        }
      });
    });
    return {
      request: (path: string, token: string, method = 'GET', body?: unknown) =>
        fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      stop: async () => {
        child.kill('SIGTERM');
        await once(child, 'exit');
      },
    };
  }
  const input = intent('Persistent demo submission');
  const path = `/v1/profiles/${fan.demo.id}/submissions`;
  const first = await start();
  let receipt;
  try {
    const response = await first.request(path, fan.token, 'POST', input);
    assert.equal(response.status, 201);
    receipt = await response.json();
    const response2 = await first.request(
      `/v1/admin/submissions/${receipt.outcome.id}/decision`,
      admin.token,
      'POST',
      { requestId: randomUUID(), status: 'rejected' },
    );
    assert.equal(response2.status, 200);
  } finally {
    await first.stop();
  }
  const second = await start();
  try {
    const page = await second.request(path, fan.token);
    assert.equal(page.status, 200);
    const stored = (await page.json()).submissions[0];
    assert.equal(stored.id, receipt.outcome.id);
    assert.equal(stored.status, 'rejected');
    assert.equal(stored.profileKind, 'demo');
    const replay = await second.request(path, fan.token, 'POST', input);
    assert.equal(replay.status, 201);
    assert.deepEqual(await replay.json(), receipt);
    const history = await second.request(
      `/v1/profiles/${fan.demo.id}/points/history`,
      fan.token,
    );
    const current = await history.json();
    assert.equal(current.balance, 100);
    assert.equal(
      current.entries.filter(
        (entry: { kind: string }) => entry.kind === 'fan_submission',
      ).length,
      1,
    );
  } finally {
    await second.stop();
  }
});

test('the owned HTTP adapter exposes bounded owner and moderation routes through the same policy', async () => {
  const admin = await account('adapter-admin', true);
  const fan = await account('adapter-fan');
  await grant(admin.token, fan.real.id, 600);
  const base = {
    pool,
    token: fan.token,
    query: {},
    body: async () => intent(),
  };
  const created = await handleSubmissionRequest({
    ...base,
    method: 'POST',
    path: `/v1/profiles/${fan.real.id}/submissions`,
  });
  assert.equal(created?.status, 201);
  const [row] = (await listOwnSubmissions(pool, fan.token, fan.real.id))
    .submissions;
  const path = `/v1/admin/submissions/${row.id}/decision`;
  const decision = {
    ...base,
    method: 'POST',
    path,
    body: async () => ({ requestId: randomUUID(), status: 'approved' }),
  };
  await assert.rejects(handleSubmissionRequest(decision), status(403));
  assert.equal(
    (await handleSubmissionRequest({ ...decision, token: admin.token }))
      ?.status,
    200,
  );
  assert.equal(
    (await listOwnSubmissions(pool, fan.token, fan.real.id)).submissions[0]
      .status,
    'approved',
  );
  await assert.rejects(
    handleSubmissionRequest({
      ...base,
      path: `/v1/profiles/${fan.real.id}/submissions`,
      method: 'DELETE',
    }),
    status(405),
  );
  await assert.rejects(
    handleSubmissionRequest({
      ...base,
      path: '/v1/admin/submissions',
      method: 'GET',
    }),
    status(403),
  );
  await assert.rejects(
    handleSubmissionRequest({
      ...base,
      path,
      method: 'POST',
      token: admin.token,
      body: async () => ({ requestId: randomUUID(), status: 'fulfilled' }),
    }),
    status(400),
  );
  assert.equal(
    await handleSubmissionRequest({
      ...base,
      method: 'POST',
      path: '/v1/submissions/votes',
    }),
    null,
  );
  assert.equal(
    await handleSubmissionRequest({
      ...base,
      method: 'POST',
      path: '/v1/admin/submissions/selections',
    }),
    null,
  );
});
