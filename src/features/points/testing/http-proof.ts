// Run with the leased loopback port and this worktree's disposable test DB.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { z } from 'zod';
import { createDatabase } from '../../../../server/database/index.ts';
import { migrate } from '../../../../server/database/migrate.ts';
import { createApi } from '../../../../server/api/app.ts';
import { assignRole } from '../../../../server/accounts/store.ts';
import { AccountError, createAccountApi } from '../../account/api.ts';
import {
  createSessionController,
  type StoredSession,
} from '../../account/session.ts';
import { createHistoryController } from '../history.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  ) ||
  !/^\d{4,5}$/.test(process.env.API_PORT ?? '')
)
  throw new Error('Use db:run-test with an explicitly leased API_PORT.');

test('phone adapter and state use authorized, persistent PostgreSQL History', async (t) => {
  const port = Number(process.env.API_PORT);
  const base = `http://127.0.0.1:${port}`;
  const api = createAccountApi(base, true);
  // Controlled verifier fixtures exercise the real authorization stack, not live OIDC.
  const issuer = `https://phone-fixture.invalid/${randomUUID()}`;
  let pool = createDatabase();
  let server: ReturnType<typeof createApi> | null = null;
  async function start() {
    server = createApi({
      pool,
      env: {
        NODE_ENV: 'test',
        AUTH_ISSUER: issuer,
        AUTH_AUDIENCE: 'phone-fixture',
        AUTH_JWKS_URL: 'https://phone-fixture.invalid/jwks',
        AUTH_REQUIRED_SCOPE: 'phone-fixture',
      },
      verifyIdentity: async (token) => {
        assert.ok(['fixture-a', 'fixture-b', 'fixture-admin'].includes(token));
        return { issuer, subject: token };
      },
    });
    server.listen(port, '127.0.0.1');
    await once(server, 'listening');
  }
  async function stop() {
    if (!server) return;
    const closing = once(server, 'close');
    server.close();
    server.closeIdleConnections();
    await closing;
    server = null;
  }
  const status = (expected: number) => (error: unknown) =>
    error instanceof AccountError && error.status === expected;
  try {
    await migrate(pool);
    await start();
    const a = await api.signIn('fixture-a');
    const b = await api.signIn('fixture-b');
    const admin = await api.signIn('fixture-admin');
    const realA = a.account.profiles.find((p) => p.kind === 'real');
    const demoA = a.account.profiles.find((p) => p.kind === 'demo');
    const realB = b.account.profiles.find((p) => p.kind === 'real');
    assert.ok(realA && demoA && realB);
    await t.test(
      'fresh real/demo identities start at zero and deny foreign ownership',
      async () => {
        for (const p of a.account.profiles) {
          const value = await api.history(a.token, p.id);
          assert.equal(value.balance, 0);
          assert.deepEqual(value.entries, []);
        }
        await assert.rejects(api.history(b.token, realA.id), status(404));
        await assert.rejects(api.history('', realA.id), status(401));
      },
    );
    async function adjust(
      token: string,
      targetProfileId: string,
      delta: number,
    ) {
      return fetch(`${base}/v1/admin/points/adjustments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetProfileId,
          requestId: randomUUID(),
          delta,
          reason: 'Synthetic phone History acceptance fixture',
        }),
      });
    }
    assert.equal((await adjust(a.token, realA.id, 1)).status, 403);
    await assignRole(
      pool,
      admin.account.id,
      'admin',
      'Synthetic phone HTTP proof only',
    );
    const receipt = z.object({ id: z.uuid(), sequence: z.string() });
    const ids: string[] = [];
    for (let i = 0; i < 31; i++) {
      const response = await adjust(admin.token, realA.id, i === 0 ? 100 : -1);
      assert.equal(response.status, 201);
      ids.push(receipt.parse(await response.json()).id);
    }
    assert.equal((await adjust(admin.token, demoA.id, 77)).status, 201);
    assert.equal(
      (await adjust(admin.token, realB.id, 2_147_483_647)).status,
      201,
    );
    await t.test(
      '25-entry pages preserve server order with no missing/duplicate records and separate real/demo balances',
      async () => {
        const started = performance.now();
        const first = await api.history(a.token, realA.id);
        const elapsed = performance.now() - started;
        assert.equal(first.entries.length, 25);
        assert.ok(first.nextCursor);
        const second = await api.history(a.token, realA.id, first.nextCursor);
        assert.equal(second.entries.length, 6);
        assert.equal(second.nextCursor, null);
        assert.deepEqual(
          [...first.entries, ...second.entries].map((e) => e.id),
          [...ids].reverse(),
        );
        assert.equal(first.balance, 70);
        assert.equal(second.balance, 70);
        assert.equal((await api.history(a.token, demoA.id)).balance, 77);
        assert.equal(
          (await api.history(b.token, realB.id)).balance,
          2_147_483_647,
        );
        await assert.rejects(
          api.history(b.token, realA.id, first.nextCursor),
          status(404),
        );
        await assert.rejects(api.history(admin.token, realA.id), status(404));
        t.diagnostic(
          `First page: 1 request, 25 entries, ${Buffer.byteLength(JSON.stringify(first))} decoded JSON bytes, ${elapsed.toFixed(1)} ms local sample (not a benchmark).`,
        );
      },
    );
    let stored: StoredSession | null = null;
    const storage = {
      read: async () => stored,
      write: async (value: StoredSession) => {
        stored = value;
      },
      clear: async () => {
        stored = null;
      },
    };
    let session = createSessionController(api, storage);
    await session.signIn(async () => a);
    await session.select('demo');
    await t.test(
      'server/pool and phone-controller restarts retain profile selection, identity and History',
      async () => {
        await stop();
        await pool.end();
        pool = createDatabase();
        await start();
        session = createSessionController(api, storage);
        await session.resume();
        assert.equal(session.getState().kind, 'signedIn');
        assert.deepEqual(session.getState(), {
          kind: 'signedIn',
          token: a.token,
          selected: 'demo',
          account: await api.resume(a.token),
        });
        assert.equal((await api.history(a.token, demoA.id)).balance, 77);
        assert.equal((await api.signIn('fixture-a')).account.id, a.account.id);
      },
    );
    const history = createHistoryController(api.history, session.expire);
    await history.setContext({ token: a.token, profileId: realA.id });
    await t.test(
      'outage hides refreshed values; recovery works; offline logout survives controller restart and revokes on retry',
      async () => {
        await stop();
        await history.refresh();
        assert.equal(history.getState().kind, 'unavailable');
        await start();
        await history.refresh();
        assert.equal(history.getState().kind, 'ready');
        await stop();
        await session.logout();
        await history.setContext(null);
        assert.equal(history.getState().kind, 'idle');
        session = createSessionController(api, storage);
        await session.resume();
        assert.equal(session.getState().kind, 'unavailable');
        await start();
        await session.resume();
        assert.equal(session.getState().kind, 'signedOut');
        assert.equal(stored, null);
        await assert.rejects(api.history(a.token, realA.id), status(401));
      },
    );
    await t.test(
      'expired server session clears phone authority and History; prior History remains immutable',
      async () => {
        const active = await api.signIn('fixture-a');
        await session.signIn(async () => active);
        const current = createHistoryController(api.history, session.expire);
        await current.setContext({ token: active.token, profileId: realA.id });
        await pool.query(
          "UPDATE app.sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1",
          [createHash('sha256').update(active.token).digest('hex')],
        );
        await current.refresh();
        assert.equal(session.getState().kind, 'signedOut');
        assert.equal(stored, null);
        assert.equal(current.getState().kind, 'idle');
        const fresh = await api.signIn('fixture-a');
        const page = await api.history(fresh.token, realA.id);
        assert.deepEqual(
          page.entries.map((e) => e.id),
          [...ids].reverse().slice(0, 25),
        );
        assert.equal(page.balance, 70);
      },
    );
  } finally {
    await stop();
    await pool.end();
    // Immutable synthetic records remain only in this disposable test namespace.
  }
});
