import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createActivitySubmissionService } from './submission-service.ts';

const requestId = '123e4567-e89b-42d3-a456-426614174000';
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3YxJ5QAAAABJRU5ErkJggg==',
  'base64',
).toString('base64');
const body = {
  requestId,
  description: 'valid activity',
  photos: [{ mime: 'image/png', base64: tinyPng }],
};

test('pre-aborted submission cancels before provider or database work', async () => {
  const controller = new AbortController();
  controller.abort();
  let queries = 0;
  let providerCalls = 0;
  const service = createActivitySubmissionService({
    pool: {
      query: async () => {
        queries++;
        throw new Error('database must not be touched');
      },
    } as any,
    provider: {
      assess: async () => {
        providerCalls++;
        throw new Error('provider must not be called');
      },
    },
    operationTimeoutMs: 1000,
  });
  const result = await service.submit({
    principalId: 'p',
    profileId: 'r',
    body,
    signal: controller.signal,
  });
  assert.deepEqual(result, {
    kind: 'result',
    result: { kind: 'cancelled', reason: 'request_cancelled' },
  });
  assert.equal(queries, 0);
  assert.equal(providerCalls, 0);
});

test('malformed canonical media fails before admission and does not invoke provider', async () => {
  let providerCalls = 0;
  const service = createActivitySubmissionService({
    pool: {
      query: async () => {
        throw new Error('database must not be touched for malformed media');
      },
    } as any,
    provider: {
      assess: async () => {
        providerCalls++;
        throw new Error('provider must not be called');
      },
    },
  });
  await assert.rejects(
    service.submit({
      principalId: 'p',
      profileId: 'r',
      body: {
        ...body,
        photos: [
          {
            mime: 'image/png',
            base64: Buffer.from('not an image').toString('base64'),
          },
        ],
      },
    }),
  );
  assert.equal(providerCalls, 0);
});
