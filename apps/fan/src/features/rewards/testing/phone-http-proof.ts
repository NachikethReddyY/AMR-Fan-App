import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { Pool } from 'pg';
import { databaseConfig } from '../../../../../../services/api/database/config.ts';
import { migrate } from '../../../../../../services/api/database/migrate.ts';
import { createApi } from '../../../../../../services/api/api/app.ts';
import { assignRole } from '../../../../../../services/api/accounts/store.ts';
import { createAccountApi, AccountError } from '../../account/api.ts';
import { createRewardsApi } from '../api.ts';
import { createSubmissionsApi } from '../../submissions/api.ts';
import { createPurchaseController } from '../state.ts';
import { z } from 'zod';
if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    '/amr_c787cd74526c_test'
)
  throw new Error('Own isolated test namespace only.');
test('phone fan adapters transact with current authorized API/PostgreSQL', async (t) => {
  const pool = new Pool({ ...databaseConfig(), max: 2 });
  const issuer = `https://phone.invalid/${randomUUID()}`;
  const server = createApi({
    pool,
    env: {
      NODE_ENV: 'test',
      AUTH_ISSUER: issuer,
      AUTH_AUDIENCE: 'phone',
      AUTH_JWKS_URL: 'https://phone.invalid/jwks',
      AUTH_REQUIRED_SCOPE: 'phone',
    },
    verifyIdentity: async (subject) => ({ issuer, subject }),
  });
  const tokens: string[] = [];
  try {
    await migrate(pool);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const api = createAccountApi(`http://127.0.0.1:${addr.port}`, true);
    const rewards = createRewardsApi(api.request);
    const submissions = createSubmissionsApi(api.request);
    const a = await api.signIn('A');
    const b = await api.signIn('B');
    const admin = await api.signIn('admin');
    tokens.push(a.token, b.token, admin.token);
    const real = a.account.profiles.find((p) => p.kind === 'real')!;
    const demo = a.account.profiles.find((p) => p.kind === 'demo')!;
    const ctx = { token: a.token, profileId: real.id };
    const foreign = { token: b.token, profileId: real.id };
    await assignRole(
      pool,
      admin.account.id,
      'admin',
      'Synthetic phone HTTP proof',
    );
    await api.request('/v1/admin/points/adjustments', admin.token, 'POST', {
      targetProfileId: real.id,
      requestId: randomUUID(),
      delta: 5000,
      reason: 'Synthetic phone proof funding',
    });
    const newOffer = async (kind: 'tree' | 'content' | 'discount') =>
      z.object({ id: z.uuid(), version: z.number() }).parse(
        await api.request('/v1/admin/rewards/offers', admin.token, 'POST', {
          requestId: randomUUID(),
          enabled: true,
          product: {
            kind,
            title: `Phone fixture ${kind}`,
            description: 'Synthetic proof only',
            pointsPrice: 400,
            ...(kind === 'content'
              ? { text: 'Retained literal <script>text</script>' }
              : {}),
            ...(kind === 'discount' ? { percentage: 10 } : {}),
          },
        }),
      );
    const tree = await newOffer('tree');
    const content = await newOffer('content');
    const voucher = await newOffer('discount');
    const forbidden = (e: unknown) =>
      e instanceof AccountError && e.status === 404;
    await t.test(
      'anonymous and foreign profile are denied; real/demo balances remain distinct',
      async () => {
        await assert.rejects(rewards.receipts(foreign), forbidden);
        await assert.rejects(submissions.list(foreign), forbidden);
        await assert.rejects(
          rewards.offers({ ...ctx, token: '' }),
          (e) => e instanceof AccountError && e.status === 401,
        );
        assert.equal((await api.history(a.token, demo.id)).balance, 0);
      },
    );
    await t.test(
      'server-priced purchase retry after lost response/restart creates one immutable receipt',
      async () => {
        const data = new Map<string, string>();
        const storage = {
          read: async (k: string) => data.get(k) ?? null,
          write: async (k: string, v: string) => {
            data.set(k, v);
          },
          clear: async (k: string) => {
            data.delete(k);
          },
        };
        let lost = true;
        const adapter = {
          ...rewards,
          purchase: async (...args: Parameters<typeof rewards.purchase>) => {
            const result = await rewards.purchase(...args);
            if (lost) {
              lost = false;
              throw new Error('Controlled lost response');
            }
            return result;
          },
        };
        const first = createPurchaseController(adapter, storage, () => {});
        await first.setContext(ctx);
        await first.submit({
          requestId: randomUUID(),
          offerId: tree.id,
          offerVersion: tree.version,
        });
        assert.equal(first.getState().kind, 'retry');
        const restart = createPurchaseController(adapter, storage, () => {});
        await restart.setContext(ctx);
        await restart.retry();
        assert.equal(restart.getState().kind, 'success');
        assert.equal((await api.history(a.token, real.id)).balance, 4600);
      },
    );
    await t.test(
      'retained content is readable after disable without another debit; stale price rejects',
      async () => {
        const input = {
          requestId: randomUUID(),
          offerId: content.id,
          offerVersion: content.version,
        };
        const receipt = await rewards.purchase(ctx, input);
        await api.request('/v1/admin/rewards/offers', admin.token, 'PATCH', {
          requestId: randomUUID(),
          offerId: content.id,
          expectedVersion: content.version,
          enabled: false,
          product: {
            kind: 'content',
            title: 'Updated',
            description: 'Changed',
            pointsPrice: 800,
            text: 'New version',
          },
        });
        assert.equal(
          (await rewards.content(ctx, content.id)).text,
          'Retained literal <script>text</script>',
        );
        assert.equal(
          (await rewards.content(ctx, content.id)).receipt.id,
          receipt.id,
        );
        await assert.rejects(rewards.content(foreign, content.id), forbidden);
        await api.request('/v1/admin/rewards/offers', admin.token, 'PATCH', {
          requestId: randomUUID(),
          offerId: voucher.id,
          expectedVersion: voucher.version,
          enabled: true,
          product: {
            kind: 'discount',
            title: 'Changed voucher',
            description: 'Synthetic',
            pointsPrice: 800,
            percentage: 10,
          },
        });
        await assert.rejects(
          rewards.purchase(ctx, {
            requestId: randomUUID(),
            offerId: voucher.id,
            offerVersion: 1,
          }),
          (e) => e instanceof AccountError && e.status === 409,
        );
        assert.equal((await api.history(a.token, real.id)).balance, 4200);
        const current = await rewards.offer(ctx, voucher.id);
        const saved = await rewards.purchase(ctx, {
          requestId: randomUUID(),
          offerId: current.id,
          offerVersion: current.version,
        });
        assert.equal(saved.paidPoints, 800);
        assert.equal(saved.kind, 'discount');
      },
    );
    await t.test(
      'paid submission replay retains original receipt while current status changes',
      async () => {
        const input = {
          requestId: randomUUID(),
          text: 'Synthetic fan question',
          tag: 'question' as const,
          confirmedFee: 500 as const,
          resubmissionOf: null,
        };
        const receipt = await submissions.submit(ctx, input);
        await submissions.submit(ctx, input);
        await api.request(
          `/v1/admin/submissions/${receipt.id}/decision`,
          admin.token,
          'POST',
          { requestId: randomUUID(), status: 'rejected' },
        );
        assert.equal(
          (await submissions.list(ctx)).items.find((s) => s.id === receipt.id)
            ?.status,
          'rejected',
        );
        assert.equal((await submissions.submit(ctx, input)).status, 'pending');
        const retry = await submissions.submit(ctx, {
          ...input,
          requestId: randomUUID(),
          resubmissionOf: receipt.id,
        });
        assert.equal(retry.resubmissionOf, receipt.id);
        assert.equal((await api.history(a.token, real.id)).balance, 2400);
      },
    );
    await t.test(
      'receipts/history persist after reconnect; revoked session is rejected',
      async () => {
        const resumed = await api.resume(a.token);
        assert.equal(resumed.id, a.account.id);
        assert.equal((await rewards.receipts(ctx)).items.length, 3);
        const rows = await api.history(a.token, real.id);
        assert.equal(rows.balance, 2400);
        assert.equal(
          rows.entries.filter((e) => e.kind === 'reward_purchase').length,
          3,
        );
        assert.equal(
          rows.entries.filter((e) => e.kind === 'fan_submission').length,
          2,
        );
        await api.logout(a.token);
        await assert.rejects(
          rewards.receipts(ctx),
          (e) => e instanceof AccountError && e.status === 401,
        );
      },
    );
  } finally {
    for (const token of tokens) {
      await pool.query(
        "UPDATE app.sessions SET revoked_at=clock_timestamp() WHERE token_hash=encode(sha256($1::bytea),'hex')",
        [Buffer.from(token)],
      );
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
