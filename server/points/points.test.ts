import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { assignRole, ensureAccount } from '../accounts/store.ts';
import { createSession, revokeSession } from '../auth/session.ts';
import { createApi } from '../api/app.ts';
import { runPointsOperation, readPointsHistory } from './index.ts';
import { MAX_POINTS, historyEntry } from './contracts.ts';
import { z } from 'zod';

if (
  process.env.NODE_ENV !== 'test' ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use this worktree disposable test database.');

const pool = createDatabase();
const issuer = `urn:amr:points-test:${randomUUID()}`;
let server: ReturnType<typeof createApi>;
let base = '';
async function account(subject: string, admin = false) {
  const value = await ensureAccount(pool, { issuer, subject });
  if (admin) await assignRole(pool, value.id, 'admin', 'Synthetic points test');
  const session = await createSession(pool, value.id);
  const real = value.profiles.find((profile) => profile.kind === 'real');
  const demo = value.profiles.find((profile) => profile.kind === 'demo');
  assert.ok(real && demo);
  return { ...value, token: session.token, real, demo };
}
async function request(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
before(async () => {
  await migrate(pool);
  server = createApi({
    pool,
    env: {
      NODE_ENV: 'test',
      AUTH_DEV_ENABLED: 'true',
      API_HOST: '127.0.0.1',
      ADMIN_ORIGIN: 'http://127.0.0.1:55437',
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  if (server) {
    server.close();
    await once(server, 'close');
  }
  // Immutable accounting fixtures remain in this disposable test namespace.
  await pool.end();
});

test('History orders numeric sequences across a digit boundary and paginates only the owned profile', async () => {
  const admin = await account('numeric-history-admin', true);
  const fan = await account('numeric-history-fan');
  const other = await account('numeric-history-other');
  // Advance only the disposable test sequence so repeat runs also cross a digit boundary.
  const sequence = await pool.query<{ last_value: string }>(
    'SELECT last_value::text FROM app.points_operations_sequence_seq',
  );
  let boundary = 10n;
  while (boundary - 3n <= BigInt(sequence.rows[0].last_value)) boundary *= 10n;
  await pool.query(
    "SELECT setval(pg_get_serial_sequence('app.points_operations', 'sequence'), $1::bigint, false)",
    [(boundary - 3n).toString()],
  );
  async function record(profileId: string, delta: number) {
    const response = await adjust(admin.token, profileId, delta);
    assert.equal(response.status, 201);
    return historyEntry.parse(await response.json());
  }
  const first = await record(fan.real.id, 10);
  const second = await record(fan.real.id, -10);
  const grant = await record(fan.real.id, 600);
  const debit = await record(fan.real.id, -500);
  assert.equal(grant.sequence, (boundary - 1n).toString());
  assert.equal(debit.sequence, boundary.toString());
  const atBoundary = await history(fan.token, fan.real.id);
  assert.equal(atBoundary.balance, 100);
  assert.deepEqual(atBoundary.entries, [debit, grant, second, first]);

  const demo = await record(fan.demo.id, 77);
  const foreign = await record(other.real.id, 88);
  const fifth = await record(fan.real.id, 20);
  const sixth = await record(fan.real.id, -20);
  async function page(before?: string) {
    const response = await request(
      `/v1/profiles/${fan.real.id}/points/history?limit=2${before ? `&before=${before}` : ''}`,
      fan.token,
    );
    assert.equal(response.status, 200);
    return z
      .object({
        balance: z.number(),
        entries: z.array(historyEntry),
        nextCursor: z.string().nullable(),
      })
      .parse(await response.json());
  }
  const newest = await page();
  assert.equal(newest.nextCursor, fifth.sequence);
  const middle = await page(newest.nextCursor);
  assert.equal(middle.nextCursor, grant.sequence);
  const oldest = await page(middle.nextCursor);
  assert.equal(oldest.nextCursor, null);
  assert.deepEqual(
    [newest.balance, middle.balance, oldest.balance],
    [100, 100, 100],
  );
  const entries = [...newest.entries, ...middle.entries, ...oldest.entries];
  assert.deepEqual(entries, [sixth, fifth, debit, grant, second, first]);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 6);
  assert.deepEqual((await history(fan.token, fan.demo.id)).entries, [demo]);
  assert.deepEqual((await history(other.token, other.real.id)).entries, [
    foreign,
  ]);
  const denied = await request(
    `/v1/profiles/${fan.real.id}/points/history?limit=2&before=${fifth.sequence}`,
    other.token,
  );
  assert.equal(denied.status, 404);
});

test('assigned admin grants points and the intended fan reads the recorded History', async () => {
  const admin = await account('admin', true);
  const fan = await account('fan');
  const input = {
    targetProfileId: fan.real.id,
    requestId: randomUUID(),
    delta: 100,
    reason: 'Event participation correction',
  };
  const response = await request(
    '/v1/admin/points/adjustments',
    admin.token,
    'POST',
    input,
  );
  assert.equal(response.status, 201);
  const receipt = await response.json();
  assert.equal(receipt.delta, 100);
  assert.equal(receipt.balanceAfter, 100);
  assert.equal(receipt.reason, input.reason);
  assert.equal(receipt.actorId, admin.id);
  assert.ok(Number.isFinite(Date.parse(receipt.recordedAt)));
  const history = await request(
    `/v1/profiles/${fan.real.id}/points/history`,
    fan.token,
  );
  assert.equal(history.status, 200);
  const page = await history.json();
  assert.equal(page.balance, 100);
  assert.equal(page.entries.length, 1);
  assert.deepEqual(page.entries[0], receipt);
  const demo = await request(`/v1/profiles/${fan.demo.id}`, fan.token);
  assert.equal((await demo.json()).balance, 0);
});

async function adjust(
  token: string,
  profile: string,
  delta: number,
  requestId = randomUUID(),
  reason = 'Synthetic correction',
) {
  return request('/v1/admin/points/adjustments', token, 'POST', {
    targetProfileId: profile,
    requestId,
    delta,
    reason,
  });
}
async function history(token: string, profile: string) {
  const response = await request(
    `/v1/profiles/${profile}/points/history`,
    token,
  );
  assert.equal(response.status, 200);
  return response.json();
}

test('corrections preserve earlier records and refuse negative balance or invalid integer input', async () => {
  const admin = await account('bounds-admin', true);
  const fan = await account('bounds-fan');
  assert.equal((await adjust(admin.token, fan.real.id, 100)).status, 201);
  const original = (await history(fan.token, fan.real.id)).entries[0];
  assert.equal((await adjust(admin.token, fan.real.id, -40)).status, 201);
  assert.equal((await adjust(admin.token, fan.real.id, -61)).status, 409);
  for (const delta of [
    0,
    0.5,
    -0.5,
    MAX_POINTS + 1,
    -MAX_POINTS - 1,
    '10',
    null,
  ]) {
    assert.equal(
      (
        await request('/v1/admin/points/adjustments', admin.token, 'POST', {
          targetProfileId: fan.real.id,
          requestId: randomUUID(),
          delta,
          reason: 'Invalid fixture',
        })
      ).status,
      400,
    );
  }
  for (const reason of ['', '   ', 'x'.repeat(501), 'line\nbreak'])
    assert.equal(
      (await adjust(admin.token, fan.real.id, 1, randomUUID(), reason)).status,
      400,
    );
  const page = await history(fan.token, fan.real.id);
  assert.equal(page.balance, 60);
  assert.equal(page.entries.length, 2);
  assert.deepEqual(page.entries[1], original);
  assert.equal(
    (await adjust(admin.token, fan.real.id, MAX_POINTS - 60)).status,
    201,
  );
  assert.equal((await adjust(admin.token, fan.real.id, 1)).status, 409);
  assert.equal((await history(fan.token, fan.real.id)).balance, MAX_POINTS);
});

test('fan, forged client authority, cross-account reads and revoked credentials cannot adjust or read another profile', async () => {
  const admin = await account('auth-admin', true);
  const a = await account('auth-a');
  const b = await account('auth-b');
  assert.equal((await adjust(a.token, b.real.id, 100)).status, 403);
  for (const token of ['', 'forged'])
    assert.equal((await adjust(token, b.real.id, 100)).status, 401);
  for (const field of ['role', 'badge', 'actorId', 'ownerId', 'balance']) {
    assert.equal(
      (
        await request('/v1/admin/points/adjustments', admin.token, 'POST', {
          targetProfileId: b.real.id,
          requestId: randomUUID(),
          delta: 100,
          reason: 'Forged field',
          [field]: 'admin',
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (await request(`/v1/profiles/${b.real.id}/points/history`, a.token)).status,
    404,
  );
  assert.equal(
    (await request(`/v1/admin/profiles/${b.real.id}/points/history`, a.token))
      .status,
    403,
  );
  await assignRole(pool, admin.id, 'fan', 'Test revocation');
  assert.equal((await adjust(admin.token, b.real.id, 100)).status, 403);
  await assignRole(pool, admin.id, 'admin', 'Restore fixture');
  await revokeSession(pool, admin.token);
  assert.equal((await adjust(admin.token, b.real.id, 100)).status, 401);
  const expired = await createSession(pool, admin.id);
  await pool.query(
    "UPDATE app.sessions SET expires_at = now() - interval '1 second' WHERE principal_id = $1",
    [admin.id],
  );
  assert.equal((await adjust(expired.token, b.real.id, 100)).status, 401);
  assert.equal((await history(b.token, b.real.id)).balance, 0);
});

test('successful retries return the immutable result and changed payload or target keys conflict', async () => {
  const admin = await account('retry-admin', true);
  const fan = await account('retry-fan');
  const key = randomUUID();
  const responses = await Promise.all(
    Array.from({ length: 8 }, () => adjust(admin.token, fan.real.id, 100, key)),
  );
  const receipts = await Promise.all(
    responses.map(async (response) => {
      assert.equal(response.status, 201);
      return response.json();
    }),
  );
  for (const receipt of receipts) assert.deepEqual(receipt, receipts[0]);
  await adjust(admin.token, fan.real.id, 25);
  assert.deepEqual(
    await (await adjust(admin.token, fan.real.id, 100, key)).json(),
    receipts[0],
  );
  assert.equal((await adjust(admin.token, fan.real.id, 99, key)).status, 409);
  assert.equal(
    (await adjust(admin.token, fan.real.id, 100, key, 'Changed reason')).status,
    409,
  );
  assert.equal((await adjust(admin.token, fan.demo.id, 100, key)).status, 409);
  assert.equal((await history(fan.token, fan.real.id)).balance, 125);
  assert.equal((await history(fan.token, fan.real.id)).entries.length, 2);
  assert.equal((await history(fan.token, fan.demo.id)).balance, 0);
});

test('concurrent changed-target key reuse records only one target outcome', async () => {
  const admin = await account('target-admin', true);
  const fan = await account('target-fan');
  const key = randomUUID();
  const results = await Promise.all([
    adjust(admin.token, fan.real.id, 40, key),
    adjust(admin.token, fan.demo.id, 40, key),
  ]);
  assert.deepEqual(
    results.map((response) => response.status).sort(),
    [201, 409],
  );
  const pages = await Promise.all([
    history(fan.token, fan.real.id),
    history(fan.token, fan.demo.id),
  ]);
  assert.deepEqual(pages.map((page) => page.balance).sort(), [0, 40]);
  assert.equal(pages.flatMap((page) => page.entries).length, 1);
});

test('concurrent adjustments preserve all credits and refuse a second unaffordable debit', async () => {
  const admin = await account('concurrent-admin', true);
  const fan = await account('concurrent-fan');
  await Promise.all(
    Array.from({ length: 10 }, async () => {
      assert.equal((await adjust(admin.token, fan.real.id, 10)).status, 201);
    }),
  );
  assert.equal((await history(fan.token, fan.real.id)).balance, 100);
  const debits = await Promise.all([
    adjust(admin.token, fan.real.id, -80),
    adjust(admin.token, fan.real.id, -80),
  ]);
  assert.deepEqual(
    debits.map((response) => response.status).sort(),
    [201, 409],
  );
  const page = await history(fan.token, fan.real.id);
  assert.equal(page.balance, 20);
  assert.equal(page.entries.length, 11);
});

test('stored role change wins before a blocked adjustment obtains current authority', async () => {
  const admin = await account('race-role-admin', true);
  const fan = await account('race-role-fan');
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    await connection.query(
      "UPDATE app.principals SET role = 'fan' WHERE id = $1",
      [admin.id],
    );
    const pending = adjust(admin.token, fan.real.id, 100);
    await connection.query('COMMIT');
    assert.equal((await pending).status, 403);
    assert.equal((await history(fan.token, fan.real.id)).balance, 0);
  } finally {
    await connection.query('ROLLBACK');
    connection.release();
  }
});

async function withSessionLockWait<T>(
  token: string,
  expire: boolean,
  action: () => Promise<T>,
) {
  const hash = createHash('sha256').update(token).digest('hex');
  await pool.query(
    'UPDATE app.sessions SET expires_at = clock_timestamp() + $2::interval WHERE token_hash = $1',
    [hash, expire ? '2 seconds' : '1 minute'],
  );
  const clock = async () =>
    (
      await pool.query<{ valid: boolean }>(
        'SELECT expires_at > clock_timestamp() AS valid FROM app.sessions WHERE token_hash = $1',
        [hash],
      )
    ).rows[0];
  const holder = await pool.connect();
  let pending: Promise<T> | undefined;
  try {
    await holder.query('BEGIN');
    await holder.query('SET LOCAL idle_in_transaction_session_timeout = 15000');
    const holderPid = (
      await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
    ).rows[0].pid;
    // Do not update the tuple while blocked: that would trigger PostgreSQL's row recheck.
    await holder.query(
      'SELECT token_hash FROM app.sessions WHERE token_hash = $1 FOR UPDATE',
      [hash],
    );
    assert.equal((await clock()).valid, true);
    pending = action();
    void pending.catch(() => {});
    async function waiter() {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const result = await pool.query<{ pid: number }>(
          `SELECT pid FROM pg_stat_activity
           WHERE datname = current_database() AND usename = current_user
           AND wait_event_type = 'Lock' AND query LIKE '%FROM app.sessions%FOR SHARE%'
           AND $1::int = ANY(pg_blocking_pids(pid))`,
          [holderPid],
        );
        if (result.rows[0]) return result.rows[0].pid;
        await delay(10);
      }
      assert.fail('The session authorization waiter was not observed.');
    }
    const waitingPid = await waiter();
    assert.equal((await clock()).valid, true);
    if (expire) {
      const deadline = Date.now() + 8000;
      while ((await clock()).valid) {
        assert.ok(
          Date.now() < deadline,
          'Database-clock expiry was not observed.',
        );
        await delay(10);
      }
    }
    assert.equal((await clock()).valid, !expire);
    assert.equal(await waiter(), waitingPid);
    await holder.query('ROLLBACK');
    return await pending;
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
    await pending?.catch(() => {});
  }
}

test('session validity is checked after its unchanged authority row lock is acquired', async (t) => {
  for (const expire of [false, true]) {
    for (const replay of [false, true]) {
      await t.test(
        `${expire ? 'expired' : 'valid'} ${replay ? 'replay' : 'fresh adjustment'}`,
        async () => {
          const subject = `authority-wait-${expire}-${replay}`;
          const admin = await account(`${subject}-admin`, true);
          const fan = await account(`${subject}-fan`);
          const other = await account(`${subject}-other`);
          const key = randomUUID();
          const action = () => adjust(admin.token, fan.real.id, 17, key);
          const receipt = replay
            ? historyEntry.parse(await (await action()).json())
            : null;
          const original = await history(fan.token, fan.real.id);
          const unrelated = await history(other.token, other.real.id);
          const response = await withSessionLockWait(
            admin.token,
            expire,
            action,
          );
          assert.equal(response.status, expire ? 401 : 201);
          const result = await history(fan.token, fan.real.id);
          if (expire || replay) assert.deepEqual(result, original);
          else {
            assert.equal(result.balance, 17);
            assert.equal(result.entries.length, 1);
          }
          if (!expire && replay)
            assert.deepEqual(await response.json(), receipt);
          assert.deepEqual(
            await history(other.token, other.real.id),
            unrelated,
          );
        },
      );
    }
  }
});

test('expired authority lock waits cannot run a composed domain effect', async (t) => {
  await pool.query('CREATE SCHEMA IF NOT EXISTS local_fixture');
  await pool.query(
    'CREATE TABLE IF NOT EXISTS local_fixture.points_effects(id uuid PRIMARY KEY, profile_id uuid NOT NULL)',
  );
  for (const expire of [false, true]) {
    await t.test(expire ? 'expired effect' : 'valid effect', async () => {
      const fan = await account(`authority-domain-${expire}`);
      const original = await history(fan.token, fan.real.id);
      let calls = 0;
      const operation = () =>
        runPointsOperation({
          pool,
          token: fan.token,
          access: 'owner',
          request: {
            profileId: fan.real.id,
            requestId: randomUUID(),
            kind: 'synthetic_lock_wait_effect',
          },
          intent: 'synthetic effect 17',
          outcomeSchema: z.null(),
          perform: async ({ client, operationId }) => {
            calls++;
            await client.query(
              'INSERT INTO local_fixture.points_effects VALUES ($1,$2)',
              [operationId, fan.real.id],
            );
            return {
              delta: 17,
              reason: 'Synthetic lock wait effect',
              outcome: null,
            };
          },
        });
      if (expire) {
        await assert.rejects(withSessionLockWait(fan.token, true, operation), {
          status: 401,
        });
        const resumed = await createSession(pool, fan.id);
        assert.deepEqual(await history(resumed.token, fan.real.id), original);
      } else {
        const result = await withSessionLockWait(fan.token, false, operation);
        assert.equal(result.entry.balanceAfter, 17);
        assert.equal((await history(fan.token, fan.real.id)).entries.length, 1);
      }
      assert.equal(calls, expire ? 0 : 1);
      const effects = await pool.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM local_fixture.points_effects WHERE profile_id = $1',
        [fan.real.id],
      );
      assert.equal(effects.rows[0].count, expire ? 0 : 1);
    });
  }
});

test('History is immutable at the database boundary and pages stay owned and ordered', async () => {
  const admin = await account('history-admin', true);
  const fan = await account('history-fan');
  for (const delta of [10, 20, -5])
    await adjust(admin.token, fan.real.id, delta);
  const original = await history(fan.token, fan.real.id);
  const id = original.entries[0].id;
  for (const statement of [
    'UPDATE app.points_operations SET reason = reason WHERE id = $1',
    'DELETE FROM app.points_operations WHERE id = $1',
  ])
    await assert.rejects(pool.query(statement, [id]), { code: '23514' });
  await assert.rejects(pool.query('TRUNCATE app.points_operations'), {
    code: '23514',
  });
  assert.deepEqual(await history(fan.token, fan.real.id), original);
  const first = await request(
    `/v1/profiles/${fan.real.id}/points/history?limit=2`,
    fan.token,
  );
  const page = await first.json();
  assert.equal(page.entries.length, 2);
  const second = await request(
    `/v1/profiles/${fan.real.id}/points/history?limit=2&before=${page.nextCursor}`,
    fan.token,
  );
  assert.deepEqual((await second.json()).entries, [original.entries[2]]);
  assert.equal(
    (
      await request(
        `/v1/profiles/${fan.real.id}/points/history?limit=101`,
        fan.token,
      )
    ).status,
    400,
  );
});

test('server-only operation joins domain effects and debit in one transaction, and replay skips fresh checks', async () => {
  const admin = await account('seam-admin', true);
  const fan = await account('seam-fan');
  await adjust(admin.token, fan.real.id, 100);
  await pool.query('CREATE SCHEMA IF NOT EXISTS local_fixture');
  await pool.query(
    'CREATE TABLE IF NOT EXISTS local_fixture.points_effects(id uuid PRIMARY KEY, profile_id uuid NOT NULL)',
  );
  const key = randomUUID();
  const options = {
    pool,
    token: fan.token,
    access: 'owner' as const,
    request: {
      profileId: fan.real.id,
      requestId: key,
      kind: 'synthetic_atomic_effect',
    },
    intent: 'test effect 80',
    outcomeSchema: z.strictObject({ effectId: z.uuid() }),
  };
  const operation = () =>
    runPointsOperation({
      ...options,
      perform: async ({ client, profile, operationId }) => {
        await client.query(
          'INSERT INTO local_fixture.points_effects VALUES ($1,$2)',
          [operationId, profile.id],
        );
        return {
          delta: -80,
          reason: 'Synthetic atomic effect',
          outcome: { effectId: operationId },
        };
      },
    });
  const result = await operation();
  assert.equal(result.entry.balanceAfter, 20);
  const replay = await runPointsOperation({
    ...options,
    perform: async () => {
      throw new Error(
        'A later price/epoch check must not run for successful replay.',
      );
    },
  });
  assert.deepEqual(replay, result);
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS count FROM local_fixture.points_effects WHERE profile_id=$1',
        [fan.real.id],
      )
    ).rows[0].count,
    1,
  );
  await assert.rejects(
    runPointsOperation({
      ...options,
      request: { ...options.request, requestId: randomUUID() },
      perform: async ({ client, profile, operationId }) => {
        await client.query(
          'INSERT INTO local_fixture.points_effects VALUES ($1,$2)',
          [operationId, profile.id],
        );
        return {
          delta: -80,
          reason: 'Insufficient synthetic debit',
          outcome: { effectId: operationId },
        };
      },
    }),
    { status: 409 },
  );
  await assert.rejects(
    runPointsOperation({
      ...options,
      request: { ...options.request, requestId: randomUUID() },
      perform: async ({ client, profile, operationId }) => {
        await client.query(
          'INSERT INTO local_fixture.points_effects VALUES ($1,$2)',
          [operationId, profile.id],
        );
        throw new Error('Synthetic outcome failure');
      },
    }),
    /Synthetic outcome failure/,
  );
  assert.equal((await history(fan.token, fan.real.id)).balance, 20);
  assert.equal((await history(fan.token, fan.real.id)).entries.length, 2);
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS count FROM local_fixture.points_effects WHERE profile_id=$1',
        [fan.real.id],
      )
    ).rows[0].count,
    1,
  );
});

test('balance and History survive a new database connection and account resume', async () => {
  const admin = await account('persistent-admin', true);
  const fan = await account('persistent-fan');
  const receipt = await (await adjust(admin.token, fan.demo.id, 55)).json();
  const anotherPool = createDatabase();
  try {
    const page = await readPointsHistory(anotherPool, fan.token, fan.demo.id);
    assert.equal(page.balance, 55);
    assert.deepEqual(page.entries, [receipt]);
    const resumed = await ensureAccount(anotherPool, {
      issuer,
      subject: 'persistent-fan',
    });
    assert.equal(
      resumed.profiles.find((profile) => profile.kind === 'demo')?.balance,
      55,
    );
    assert.equal(
      resumed.profiles.find((profile) => profile.kind === 'real')?.balance,
      0,
    );
  } finally {
    await anotherPool.end();
  }
});

test('admin browser assets and explicit same-origin requests work without allowing other browser origins', async () => {
  const response = await fetch(`${base}/admin/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.match(await response.text(), /Points administration/);
  const admin = await account('browser-admin', true);
  const fan = await account('browser-fan');
  const allowed = await fetch(`${base}/v1/admin/points/profiles`, {
    headers: {
      Authorization: `Bearer ${admin.token}`,
      Origin: 'http://127.0.0.1:55437',
    },
  });
  assert.equal(allowed.status, 200);
  let profiles = await allowed.json();
  let found = profiles.profiles.some(
    (profile: { id: string }) => profile.id === fan.real.id,
  );
  while (!found && profiles.nextCursor) {
    assert.ok(profiles.profiles.length <= 50);
    profiles = await (
      await request(
        `/v1/admin/points/profiles?after=${profiles.nextCursor}`,
        admin.token,
      )
    ).json();
    found = profiles.profiles.some(
      (profile: { id: string }) => profile.id === fan.real.id,
    );
  }
  assert.ok(found);
  assert.equal(
    (await request('/v1/admin/points/profiles', fan.token)).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${base}/v1/admin/points/profiles`, {
        headers: {
          Authorization: `Bearer ${admin.token}`,
          Origin: 'https://foreign.example.test',
        },
      })
    ).status,
    403,
  );
});

test('committed points and replay survive actual API process shutdown and restart', async () => {
  const admin = await account('restart-admin', true);
  const fan = await account('restart-fan');
  const input = {
    targetProfileId: fan.real.id,
    delta: 77,
    reason: 'Restart fixture',
    requestId: randomUUID(),
  };
  async function child() {
    const process = spawn(
      globalThis.process.execPath,
      [fileURLToPath(new URL('./testing/api-process.ts', import.meta.url))],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    const closed = once(process, 'exit');
    const [chunk] = await once(process.stdout, 'data');
    const port = Number(String(chunk).trim());
    assert.ok(Number.isInteger(port) && port > 0);
    return {
      url: `http://127.0.0.1:${port}`,
      stop: async () => {
        process.kill('SIGTERM');
        await closed;
      },
    };
  }
  const first = await child();
  let saved;
  try {
    const response = await fetch(`${first.url}/v1/admin/points/adjustments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${admin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 201);
    saved = await response.json();
  } finally {
    await first.stop();
  }
  const second = await child();
  try {
    const response = await fetch(`${second.url}/v1/admin/points/adjustments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${admin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), saved);
    const page = await fetch(
      `${second.url}/v1/profiles/${fan.real.id}/points/history`,
      { headers: { Authorization: `Bearer ${fan.token}` } },
    );
    const data = await page.json();
    assert.equal(data.balance, 77);
    assert.equal(data.entries.length, 1);
  } finally {
    await second.stop();
  }
});
