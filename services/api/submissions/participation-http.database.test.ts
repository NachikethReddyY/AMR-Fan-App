import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { before, after, test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount, assignRole } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';
import { adjustPoints } from '../points/index.ts';
import { createSubmission, moderateSubmission } from './index.ts';
import { createApi } from '../api/app.ts';
import { requireOwnTestDatabase } from './participation/test-server.ts';

requireOwnTestDatabase();
const pool = createDatabase();
before(() => migrate(pool));
after(() => pool.end());
async function fixtures() {
  const account = await ensureAccount(pool, {
    issuer: 'urn:amr:participation-http',
    subject: randomUUID(),
  });
  const admin = await ensureAccount(pool, {
    issuer: 'urn:amr:participation-admin',
    subject: randomUUID(),
  });
  await assignRole(pool, admin.id, 'admin', 'Synthetic adapter fixture');
  const fanToken = (await createSession(pool, account.id)).token;
  const adminToken = (await createSession(pool, admin.id)).token;
  const profile = account.profiles.find((p) => p.kind === 'demo');
  assert.ok(profile);
  await adjustPoints(pool, adminToken, {
    targetProfileId: profile.id,
    requestId: randomUUID(),
    delta: 600,
    reason: 'Synthetic adapter fixture',
  });
  const created = await createSubmission(pool, fanToken, profile.id, {
    requestId: randomUUID(),
    text: 'A shared <script>literal</script> suggestion',
    confirmedFee: 500,
  });
  await moderateSubmission(pool, adminToken, created.outcome.id, {
    requestId: randomUUID(),
    status: 'approved',
  });
  return {
    fanToken,
    adminToken,
    admin,
    profileId: profile.id,
    submissionId: created.outcome.id,
  };
}
function requests(port: number) {
  return (path: string, token: string, method = 'GET', body?: unknown) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}

test('registered HTTP applies votes and current admin sessions, with private reads and exact retries', async () => {
  const f = await fixtures();
  const server = createApi({
    pool,
    env: { NODE_ENV: 'test', AUTH_DEV_ENABLED: 'true', API_HOST: '127.0.0.1' },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const request = requests(address.port);
  try {
    const path = `/v1/profiles/${f.profileId}/submissions/${f.submissionId}/contributions`;
    const input = { requestId: randomUUID(), points: 10 };
    const start = performance.now();
    const response = await request(path, f.fanToken, 'POST', input);
    assert.equal(response.status, 201);
    const text = await response.text();
    const receipt = JSON.parse(text);
    console.log(
      JSON.stringify({
        sample: 'loopback-adapter-vote',
        requests: 1,
        responseBytes: Buffer.byteLength(text),
        latencyMs: Number((performance.now() - start).toFixed(2)),
        providerCalls: 0,
      }),
    );
    assert.equal(receipt.entry.balanceAfter, 90);
    assert.equal(receipt.outcome.submissionId, f.submissionId);
    assert.deepEqual(
      await (await request(path, f.fanToken, 'POST', input)).json(),
      receipt,
    );
    assert.equal(
      (await request(path, f.fanToken, 'POST', { ...input, points: 20 }))
        .status,
      409,
    );
    assert.equal(
      (
        await request(path, f.fanToken, 'POST', {
          requestId: randomUUID(),
          points: 9,
        })
      ).status,
      400,
    );
    assert.equal((await request(path, '', 'POST', input)).status, 401);
    assert.equal(
      (
        await request(
          `/v1/profiles/${randomUUID()}/submissions/${f.submissionId}/contributions`,
          f.fanToken,
          'POST',
          input,
        )
      ).status,
      404,
    );
    const ranks = await (
      await request('/v1/submissions/ranking', f.fanToken)
    ).json();
    const shared = ranks.items.find(
      (row: { id: string }) => row.id === f.submissionId,
    );
    assert.ok(shared);
    assert.equal(shared.rankingPoints, '10');
    assert.equal(shared.ownerProfileId, undefined);
    const owned = await (
      await request(
        `/v1/profiles/${f.profileId}/submission-participation`,
        f.fanToken,
      )
    ).json();
    assert.equal(owned.items[0].pointsOperationId, receipt.entry.id);
    assert.equal(
      (
        await request('/v1/admin/submission-sessions', f.fanToken, 'POST', {
          requestId: randomUUID(),
        })
      ).status,
      403,
    );
    const created = await request(
      '/v1/admin/submission-sessions',
      f.adminToken,
      'POST',
      { requestId: randomUUID() },
    );
    assert.equal(created.status, 201);
    const session = await created.json();
    const closed = await request(
      `/v1/admin/submission-sessions/${session.id}/close`,
      f.adminToken,
      'POST',
      { requestId: randomUUID() },
    );
    assert.equal(closed.status, 200);
    const snapshot = await closed.json();
    assert.ok(snapshot.selections.length <= 3);
    const listed = await (
      await request('/v1/admin/submission-sessions', f.adminToken)
    ).json();
    assert.ok(
      listed.items.some(
        (item: { session: { id: string } }) => item.session.id === session.id,
      ),
    );
    if (snapshot.selections[0]) {
      const resolution = await request(
        `/v1/admin/submission-selections/${snapshot.selections[0].id}/resolve`,
        f.adminToken,
        'POST',
        {
          requestId: randomUUID(),
          action: 'fulfil',
          reason: 'Demonstration only',
        },
      );
      assert.equal(resolution.status, 200);
      assert.equal((await resolution.json()).fulfilment, 'demonstration');
    }
    await assignRole(pool, f.admin.id, 'fan', 'Synthetic adapter revocation');
    assert.equal(
      (await request('/v1/admin/submission-sessions', f.adminToken)).status,
      403,
    );
    assert.equal(
      (await request('/v1/submissions/ranking?after=invalid', f.fanToken))
        .status,
      400,
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});

async function startProcess() {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('./participation/api-process.ts', import.meta.url))],
    { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  const exit = once(child, 'exit');
  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Owned adapter startup timed out'));
    }, 5000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('Owned adapter exited before ready'));
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
    request: requests(port),
    stop: async () => {
      child.kill('SIGTERM');
      await exit;
    },
  };
}

test('registered API process restart preserves contribution and replay with one debit', async () => {
  const f = await fixtures();
  const input = { requestId: randomUUID(), points: 10 };
  const path = `/v1/profiles/${f.profileId}/submissions/${f.submissionId}/contributions`;
  const first = await startProcess();
  let receipt;
  try {
    const response = await first.request(path, f.fanToken, 'POST', input);
    assert.equal(response.status, 201);
    receipt = await response.json();
  } finally {
    await first.stop();
  }
  const second = await startProcess();
  try {
    const replay = await second.request(path, f.fanToken, 'POST', input);
    assert.equal(replay.status, 201);
    assert.deepEqual(await replay.json(), receipt);
    const current = await (
      await second.request(
        `/v1/profiles/${f.profileId}/submission-participation`,
        f.fanToken,
      )
    ).json();
    assert.equal(
      current.items.filter(
        (x: { pointsOperationId: string }) =>
          x.pointsOperationId === receipt.entry.id,
      ).length,
      1,
    );
    assert.equal(current.items[0].participation.rankingPoints, '10');
  } finally {
    await second.stop();
  }
});

test('actual createApi registers participation routes', async () => {
  const f = await fixtures();
  const server = createApi({
    pool,
    env: { NODE_ENV: 'test', AUTH_DEV_ENABLED: 'true', API_HOST: '127.0.0.1' },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await requests(address.port)(
      `/v1/profiles/${f.profileId}/submissions/${f.submissionId}/contributions`,
      f.fanToken,
      'POST',
      { requestId: randomUUID(), points: 10 },
    );
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const url = `http://127.0.0.1:${address.port}/v1/admin/submission-sessions`;
    const headers = {
      Authorization: `Bearer ${f.adminToken}`,
      'Content-Type': 'application/json',
    };
    for (const [body, expected] of [
      ['{', 400],
      ['[]', 400],
      [JSON.stringify({ padding: 'x'.repeat(4096) }), 413],
    ] as const) {
      assert.equal(
        (await fetch(url, { method: 'POST', headers, body })).status,
        expected,
      );
    }
    assert.equal(
      (
        await fetch(url, {
          method: 'POST',
          headers: { ...headers, Origin: 'https://untrusted.invalid' },
          body: JSON.stringify({ requestId: randomUUID() }),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url, {
          method: 'POST',
          headers: { Authorization: headers.Authorization },
          body: '{}',
        })
      ).status,
      415,
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});
