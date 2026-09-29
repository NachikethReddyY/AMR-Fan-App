import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { realpathSync } from 'node:fs';
import { test } from 'node:test';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../../../../../../services/api/database/index.ts';
import { migrate } from '../../../../../../services/api/database/migrate.ts';
import {
  ensureAccount,
  assignRole,
} from '../../../../../../services/api/accounts/store.ts';
import { createSession } from '../../../../../../services/api/auth/session.ts';
import { createApi } from '../../../../../../services/api/api/app.ts';
import { AccountError, createAccountApi } from '../../account/api.ts';
import { createSubmissionsApi } from '../api.ts';
import { createParticipationApi } from '../participation-api.ts';
import {
  createContributionController,
  reviewContribution,
} from '../participation-state.ts';
import {
  closedSession,
  selection,
} from '../../../../../../services/api/submissions/participation-contracts.ts';

const root = realpathSync(
  fileURLToPath(new URL('../../../../', import.meta.url)),
);
const namespace = createHash('sha256').update(root).digest('hex').slice(0, 12);
if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/amr_${namespace}_test`
)
  throw new Error('Run only against this worktree isolated test database.');

test('native participation adapters preserve paid fees, atomic retries and current status through registered HTTP', async () => {
  const pool = createDatabase();
  const server = createApi({
    pool,
    env: { NODE_ENV: 'test', AUTH_DEV_ENABLED: 'true', API_HOST: '127.0.0.1' },
  });
  try {
    await migrate(pool);
    const existing = await pool.query(
      'SELECT count(*)::int AS count FROM app.fan_submissions',
    );
    assert.equal(
      existing.rows[0].count,
      0,
      'Allocate an empty isolated fixture database; never reset shared state here.',
    );
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const accountApi = createAccountApi(
      `http://127.0.0.1:${address.port}`,
      true,
    );
    const fan = await accountApi.syntheticSignIn('fan-a');
    const other = await accountApi.syntheticSignIn('fan-b');
    const admin = await ensureAccount(pool, {
      issuer: 'urn:amr:native-participation-proof',
      subject: randomUUID(),
    });
    await assignRole(
      pool,
      admin.id,
      'admin',
      'Synthetic native participation proof',
    );
    const adminToken = (await createSession(pool, admin.id)).token;
    const real = fan.account.profiles.find((p) => p.kind === 'real');
    const demo = fan.account.profiles.find((p) => p.kind === 'demo');
    assert.ok(real && demo);
    const ctx = { token: fan.token, profileId: real.id };
    const api = createParticipationApi(accountApi.request);
    const submissions = createSubmissionsApi(accountApi.request);
    const balance = async () =>
      (await accountApi.history(ctx.token, ctx.profileId)).balance;
    const before = await balance();
    await accountApi.request(
      '/v1/admin/points/adjustments',
      adminToken,
      'POST',
      {
        targetProfileId: real.id,
        requestId: randomUUID(),
        delta: 1600,
        reason: 'Synthetic native participation proof funding',
      },
    );
    const create = (text: string) =>
      submissions.submit(ctx, {
        requestId: randomUUID(),
        text,
        tag: 'question',
        confirmedFee: 500,
        resubmissionOf: null,
      });
    const approved = await create('Synthetic approved question');
    const rejected = await create(
      'Synthetic harmful-content rejection fixture',
    );
    const pending = await create('Synthetic pending question');
    const moderate = (id: string, status: string) =>
      accountApi.request(
        `/v1/admin/submissions/${id}/decision`,
        adminToken,
        'POST',
        { requestId: randomUUID(), status },
      );
    await moderate(approved.id, 'approved');
    await moderate(rejected.id, 'rejected');
    assert.equal(
      await balance(),
      before + 100,
      'All three 500-point fees remain, including rejection',
    );
    const ranking = await api.ranking(ctx);
    const target = ranking.items.find((item) => item.id === approved.id);
    assert.ok(target);
    assert.equal(
      target.rankingPoints,
      '0',
      'Submission fee never counts in ranking',
    );
    const input = reviewContribution(target, '10', randomUUID());
    const first = await api.contribute(ctx, input);
    assert.deepEqual(await api.contribute(ctx, input), first);
    assert.equal(await balance(), before + 90, 'Retry causes one actual debit');
    assert.equal(first.rankingPointsAfter, '10');
    for (const id of [pending.id, rejected.id]) {
      await assert.rejects(
        api.contribute(ctx, {
          ...input,
          requestId: randomUUID(),
          submissionId: id,
        }),
        (e) => e instanceof AccountError && e.status === 409,
      );
    }
    await assert.rejects(
      api.history({ ...ctx, token: other.token }),
      (e) => e instanceof AccountError && e.status === 404,
    );
    await assert.rejects(
      api.ranking({ ...ctx, token: '' }),
      (e) => e instanceof AccountError && e.status === 401,
    );
    const values = new Map<string, string>();
    const storage = {
      read: async (key: string) => values.get(key) ?? null,
      write: async (key: string, value: string) => {
        values.set(key, value);
      },
      clear: async (key: string) => {
        values.delete(key);
      },
    };
    const calls: unknown[] = [];
    let lost = true;
    const lossy = {
      contribute: async (...args: Parameters<typeof api.contribute>) => {
        calls.push(args[1]);
        const receipt = await api.contribute(...args);
        if (lost) {
          lost = false;
          throw new Error('Controlled response loss after actual commit');
        }
        return receipt;
      },
    };
    const controller = createContributionController(lossy, storage, () => {});
    await controller.setContext(ctx);
    await controller.submit({ ...input, requestId: randomUUID(), points: 20 });
    assert.equal(controller.getState().kind, 'retry');
    const session = await accountApi.request(
      '/v1/admin/submission-sessions',
      adminToken,
      'POST',
      { requestId: randomUUID() },
    );
    const sessionId = z.object({ id: z.uuid() }).parse(session).id;
    const closed = closedSession.parse(
      await accountApi.request(
        `/v1/admin/submission-sessions/${sessionId}/close`,
        adminToken,
        'POST',
        { requestId: randomUUID() },
      ),
    );
    const chosen = closed.selections.find(
      (row) => row.submissionId === approved.id,
    );
    assert.ok(chosen);
    await controller.setContext(null);
    const recovered = createContributionController(lossy, storage, () => {});
    await recovered.setContext(ctx);
    await recovered.retry();
    assert.equal(
      recovered.getState().kind,
      'success',
      'Original committed receipt replays after selection freezes new contributions',
    );
    assert.deepEqual(calls[1], calls[0]);
    assert.equal(await balance(), before + 70);
    await assert.rejects(
      api.contribute(ctx, { ...input, requestId: randomUUID() }),
      (e) => e instanceof AccountError && e.status === 409,
    );
    const selected = await api.history(ctx);
    assert.equal(
      selected.items.find(
        (row) => row.pointsOperationId === first.pointsOperationId,
      )?.participation?.status,
      'selected',
    );
    const fulfilled = selection.parse(
      await accountApi.request(
        `/v1/admin/submission-selections/${chosen.id}/resolve`,
        adminToken,
        'POST',
        {
          requestId: randomUUID(),
          action: 'fulfil',
          reason: 'Synthetic demonstration only',
        },
      ),
    );
    assert.equal(fulfilled.status, 'fulfilled');
    const history = await api.history(ctx);
    assert.equal(
      history.items.find(
        (row) => row.pointsOperationId === first.pointsOperationId,
      )?.participation?.status,
      'fulfilled',
    );
    assert.equal(
      history.items.find((row) => row.submissionId === rejected.id)?.moderation,
      'rejected',
    );
    assert.equal(
      (await submissions.list(ctx)).items.find((row) => row.id === approved.id)
        ?.rankingPoints,
      0,
      'Original fee record is not rewritten',
    );
    assert.equal(
      (await accountApi.history(ctx.token, demo.id)).balance,
      demo.balance,
      'Real-profile contributions do not charge demo balance',
    );
  } finally {
    server.closeAllConnections();
    if (server.listening)
      await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
