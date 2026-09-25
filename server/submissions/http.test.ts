import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { parseSubmissionInput } from './contracts.ts';
import { ApiError } from '../accounts/types.ts';

test('one paid submission accepts a question or activity as text with an optional descriptive tag', () => {
  const requestId = randomUUID();
  assert.deepEqual(
    parseSubmissionInput({
      requestId,
      text: '  What inspired your race preparation?  ',
      confirmedFee: 500,
    }),
    {
      requestId,
      text: 'What inspired your race preparation?',
      tag: null,
      confirmedFee: 500,
      resubmissionOf: null,
    },
  );
  for (const tag of ['question', 'activity', 'other']) {
    const result = parseSubmissionInput({
      requestId,
      text: 'Fan suggestion',
      tag,
      confirmedFee: 500,
    });
    assert.equal(result.tag, tag);
    assert.equal(result.confirmedFee, 500);
  }
});

test('submission fields are bounded and reject forged authority, uploads and unconfirmed fees', () => {
  const input = {
    requestId: randomUUID(),
    text: 'A question',
    confirmedFee: 500,
  };
  for (const invalid of [
    { ...input, text: '' },
    { ...input, text: ' '.repeat(10) },
    { ...input, text: 'x'.repeat(1601) },
    { ...input, text: 'question\u0000' },
    { ...input, text: 'question\u001b' },
    { ...input, text: 'question\u202e' },
    { ...input, tag: 'vip' },
    { ...input, confirmedFee: 0 },
    { ...input, confirmedFee: '500' },
    { ...input, requestId: 'not-a-uuid' },
    { ...input, ownerId: randomUUID() },
    { ...input, role: 'admin' },
    { ...input, balance: 1000 },
    { ...input, status: 'approved' },
    { ...input, rankingPoints: 500 },
    { ...input, upload: 'https://example.test/file' },
  ])
    assert.throws(
      () => parseSubmissionInput(invalid),
      (error) => error instanceof ApiError && error.status === 400,
    );
  const text = '<script>alert("test")</script>\nLine two';
  assert.equal(parseSubmissionInput({ ...input, text }).text, text);
  assert.equal(
    parseSubmissionInput({ ...input, text: 'x'.repeat(1600) }).text.length,
    1600,
  );
});
