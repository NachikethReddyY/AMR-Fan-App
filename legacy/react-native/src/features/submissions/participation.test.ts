import { AccountError } from '../account/api';
import type { IntentStorage } from '../account/resource';
import { createParticipationApi } from './participation-api';
import {
  createContributionController,
  reviewContribution,
} from './participation-state';
import {
  contributionInput as serverInput,
  sharedSubmission as serverSubmission,
} from '../../../../../services/api/submissions/participation-contracts';

const profileId = '10000000-0000-4000-8000-000000000001';
const submissionId = '10000000-0000-4000-8000-000000000002';
const requestId = '10000000-0000-4000-8000-000000000003';
const operationId = '10000000-0000-4000-8000-000000000004';
const ctx = { token: 'session-a', profileId };
const item = {
  id: submissionId,
  text: '<script>literal fan text</script>',
  tag: 'question' as const,
  approvedAt: '2026-09-26T12:00:00.000001Z',
  rankingPoints: '9007199254740993',
  status: 'backlog' as const,
  fulfilment: 'demonstration' as const,
};
const input = { submissionId, requestId, points: 10 };
const outcome = {
  pointsOperationId: operationId,
  submissionId,
  points: 10,
  rankingPointsAfter: '9007199254741003',
  approvedAt: item.approvedAt,
};
function storage(): IntentStorage {
  const values = new Map<string, string>();
  return {
    read: async (k) => values.get(k) ?? null,
    write: async (k, v) => {
      values.set(k, v);
    },
    clear: async (k) => {
      values.delete(k);
    },
  };
}

test('ranking preserves server order, exact totals, approved timestamp and opaque cursor', async () => {
  const request = jest.fn(async () => ({
    items: [item, { ...item, id: requestId, status: 'selected' }],
    nextCursor: 'eyJwb2ludHMiOiIxIn0',
  }));
  const result = await createParticipationApi(request).ranking(
    ctx,
    'eyJwb2ludHMiOiIxIn0',
  );
  expect(request.mock.calls[0]).toEqual([
    '/v1/submissions/ranking?limit=25&after=eyJwb2ludHMiOiIxIn0',
    ctx.token,
  ]);
  expect(result.items[0]).toEqual(serverSubmission.parse(item));
  expect(result.items[1].status).toBe('selected');
});

test.each(['selected', 'fulfilled'] as const)(
  '%s cannot be reviewed for a new contribution',
  (status) => {
    expect(() =>
      reviewContribution({ ...item, status }, '10', requestId),
    ).toThrow();
  },
);
test.each(['9', '-10', '10.5', '1e2', '2147483648', '', ' 10', 'Infinity'])(
  'invalid amount %s cannot become a confirmed intent',
  (amount) => {
    expect(() => reviewContribution(item, amount, requestId)).toThrow();
  },
);
test('review preserves exact selected entry and server fixed contribution limits', () => {
  expect(reviewContribution(item, '10', requestId)).toEqual(input);
  expect(serverInput.parse({ requestId, points: input.points })).toEqual({
    requestId,
    points: 10,
  });
});

test('POST uses current profile/token and only server-owned request fields', async () => {
  const request = jest.fn(async () => ({ outcome }));
  await expect(
    createParticipationApi(request).contribute(ctx, input),
  ).resolves.toEqual(outcome);
  expect(request.mock.calls[0]).toEqual([
    `/v1/profiles/${profileId}/submissions/${submissionId}/contributions`,
    ctx.token,
    'POST',
    { requestId, points: 10 },
  ]);
});
test.each([
  { ...outcome, submissionId: requestId },
  { ...outcome, points: 11 },
])('wrong receipt is not treated as successful spend', async (bad) => {
  await expect(
    createParticipationApi(async () => ({ outcome: bad })).contribute(
      ctx,
      input,
    ),
  ).rejects.toThrow();
});
test('invalid shared status/total and duplicate rows are rejected', async () => {
  for (const items of [
    [{ ...item, status: 'pending' }],
    [{ ...item, rankingPoints: 9007199254740993 }],
    [item, item],
  ]) {
    await expect(
      createParticipationApi(async () => ({ items, nextCursor: null })).ranking(
        ctx,
      ),
    ).rejects.toThrow();
  }
});
test('History keeps operation identity and current selected/fulfilled projection', async () => {
  const rows = ['selected', 'fulfilled'].map((status, i) => ({
    pointsOperationId: i ? requestId : operationId,
    sequence: String(2 - i),
    submissionId,
    moderation: 'approved',
    participation: { ...item, status },
  }));
  const request = jest.fn(async () => ({ items: rows, nextCursor: '1' }));
  const page = await createParticipationApi(request).history(
    ctx,
    '9007199254740993',
  );
  expect(page.items.map((row) => row.id)).toEqual([operationId, requestId]);
  expect(page.items.map((row) => row.participation?.status)).toEqual([
    'selected',
    'fulfilled',
  ]);
  expect(request.mock.calls[0]).toEqual([
    `/v1/profiles/${profileId}/submission-participation?limit=25&before=9007199254740993`,
    ctx.token,
  ]);
});
test('History rejects a mismatched submission projection or continuation', async () => {
  const row = {
    pointsOperationId: operationId,
    sequence: '1',
    submissionId,
    moderation: 'approved',
    participation: { ...item, id: requestId },
  };
  await expect(
    createParticipationApi(async () => ({
      items: [row],
      nextCursor: null,
    })).history(ctx),
  ).rejects.toThrow();
});

test('lost response survives remount with original key/amount; new intent is blocked until replay resolves', async () => {
  const saved = storage();
  const request = jest
    .fn()
    .mockRejectedValueOnce(new Error('lost after commit'))
    .mockResolvedValue({ outcome });
  const api = createParticipationApi(request);
  const first = createContributionController(api, saved, jest.fn());
  await first.setContext(ctx);
  await first.submit(input);
  expect(first.getState().kind).toBe('retry');
  await first.setContext(null);
  const second = createContributionController(api, saved, jest.fn());
  await second.setContext(ctx);
  await second.submit({ ...input, requestId: operationId, points: 20 });
  expect(request).toHaveBeenCalledTimes(1);
  await second.retry();
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1]).toEqual(request.mock.calls[0]);
  expect(second.getState()).toEqual({ kind: 'success', result: outcome });
});
test('double confirmation produces one in-flight request', async () => {
  let resolve!: (value: unknown) => void;
  const request = jest.fn(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const controller = createContributionController(
    createParticipationApi(request),
    storage(),
    jest.fn(),
  );
  await controller.setContext(ctx);
  const first = controller.submit(input);
  await controller.submit(input);
  for (let i = 0; i < 10; ++i) await Promise.resolve();
  expect(request).toHaveBeenCalledTimes(1);
  resolve({ outcome });
  await first;
});
test.each([403, 404, 409, 422])(
  'server refusal %s remains refused without automatic replacement',
  async (status) => {
    const request = jest.fn(async () => {
      throw new AccountError(status, 'refused');
    });
    const controller = createContributionController(
      createParticipationApi(request),
      storage(),
      jest.fn(),
    );
    await controller.setContext(ctx);
    await controller.submit(input);
    expect(controller.getState().kind).toBe('rejected');
    await controller.retry();
    expect(request).toHaveBeenCalledTimes(1);
  },
);
test('profile switch cannot expose or replay another profile pending intent', async () => {
  const request = jest.fn(async () => {
    throw new Error('lost');
  });
  const controller = createContributionController(
    createParticipationApi(request),
    storage(),
    jest.fn(),
  );
  await controller.setContext(ctx);
  await controller.submit(input);
  await controller.setContext({ ...ctx, profileId: requestId });
  expect(controller.getState()).toEqual({ kind: 'idle' });
  await controller.retry();
  expect(request).toHaveBeenCalledTimes(1);
});
test('expired authority delegates to matching-token expiry and retains recoverable original intent', async () => {
  const saved = storage();
  const expire = jest.fn();
  const request = jest
    .fn()
    .mockRejectedValueOnce(new AccountError(401, 'expired'))
    .mockResolvedValue({ outcome });
  const controller = createContributionController(
    createParticipationApi(request),
    saved,
    expire,
  );
  await controller.setContext(ctx);
  await controller.submit(input);
  expect(expire).toHaveBeenCalledWith(ctx.token);
  await controller.setContext({ ...ctx, token: 'new-session' });
  expect(controller.getState().kind).toBe('retry');
  await controller.retry();
  expect(request.mock.calls[1][3]).toEqual({ requestId, points: 10 });
});

test('failed private storage cannot send a charge', async () => {
  const request = jest.fn(async () => ({ outcome }));
  const saved = storage();
  saved.write = async () => {
    throw new Error('storage unavailable');
  };
  const controller = createContributionController(
    createParticipationApi(request),
    saved,
    jest.fn(),
  );
  await controller.setContext(ctx);
  await controller.submit(input);
  expect(request).not.toHaveBeenCalled();
  expect(controller.getState().kind).toBe('rejected');
});
test('late success after profile switch never populates the new profile', async () => {
  let finish!: (value: unknown) => void;
  const request = jest.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const controller = createContributionController(
    createParticipationApi(request),
    storage(),
    jest.fn(),
  );
  await controller.setContext(ctx);
  const pending = controller.submit(input);
  for (let i = 0; i < 10; ++i) await Promise.resolve();
  const switching = controller.setContext({
    token: 'session-b',
    profileId: requestId,
  });
  finish({ outcome });
  await Promise.all([pending, switching]);
  expect(controller.getState()).toEqual({ kind: 'idle' });
});
test('malformed response retains original key for recovery instead of another debit', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce({ outcome: { ...outcome, points: 11 } })
    .mockResolvedValue({ outcome });
  const controller = createContributionController(
    createParticipationApi(request),
    storage(),
    jest.fn(),
  );
  await controller.setContext(ctx);
  await controller.submit(input);
  expect(controller.getState()).toMatchObject({ kind: 'retry', input });
  await controller.retry();
  expect(request.mock.calls[1]).toEqual(request.mock.calls[0]);
});

test('History preserves pending/rejected moderation without fabricating participation', async () => {
  const rows = ['pending', 'rejected'].map((moderation, i) => ({
    pointsOperationId: i ? requestId : operationId,
    sequence: String(2 - i),
    submissionId,
    moderation,
    participation: null,
  }));
  const page = await createParticipationApi(async () => ({
    items: rows,
    nextCursor: null,
  })).history(ctx);
  expect(page.items.map((row) => [row.moderation, row.participation])).toEqual([
    ['pending', null],
    ['rejected', null],
  ]);
});
test('History rejects mismatched pagination and unapproved shared content', async () => {
  const row = {
    pointsOperationId: operationId,
    sequence: '1',
    submissionId,
    moderation: 'pending',
    participation: item,
  };
  await expect(
    createParticipationApi(async () => ({
      items: [row],
      nextCursor: null,
    })).history(ctx),
  ).rejects.toThrow();
  await expect(
    createParticipationApi(async () => ({
      items: [{ ...row, participation: null }],
      nextCursor: '2',
    })).history(ctx),
  ).rejects.toThrow();
});
