import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractCandidates } from './extraction.ts';

const text = 'Water result 20 litres in 2025.';
const source = {
  permission: 'synthetic' as const,
  documentId: 'synthetic-report',
  pages: [{ page: 1, text }],
};
const fields = {
  name: { text: 'Water', start: 0, end: 5 },
  value: { text: '20', start: 13, end: 15 },
  unit: { text: 'litres', start: 16, end: 22 },
  period: { text: '2025', start: 26, end: 30 },
  category: null,
  meaning: { text: 'result', start: 6, end: 12 },
};
const review = {
  kind: 'review',
  documentId: source.documentId,
  reviewRequired: true,
  metadata: { model: 'synthetic-fixture', adapterVersion: 'synthetic-v1' },
  candidates: [
    {
      fields,
      missing: ['category'],
      evidence: { page: 1, quote: text, start: 0, end: text.length },
    },
  ],
};

test('labelled synthetic extraction retains exact fields and adds a visible missing method', async () => {
  const result = await extractCandidates({
    source,
    extractReport: async () => review,
  });
  assert.equal(result.kind, 'review');
  if (result.kind !== 'review') assert.fail('Expected a review candidate');
  assert.equal(result.metadata.model, 'synthetic-fixture');
  assert.equal(result.candidates[0]?.fields.value?.text, '20');
  assert.deepEqual(result.candidates[0]?.missing, ['category', 'method']);
});

test('unavailable and malformed extraction cannot become review data', async () => {
  assert.deepEqual(
    await extractCandidates({
      source,
      extractReport: async () => ({
        kind: 'unavailable',
        reason: 'disabled',
        reviewRequired: true,
      }),
    }),
    { kind: 'unavailable', reason: 'disabled' },
  );
  for (const value of [
    null,
    { ...review, approvedBy: 'model' },
    { ...review, documentId: 'another-source' },
    {
      ...review,
      candidates: [
        {
          ...review.candidates[0],
          fields: { ...fields, value: { text: '20', start: 0, end: 2 } },
        },
      ],
    },
  ])
    assert.deepEqual(
      await extractCandidates({ source, extractReport: async () => value }),
      { kind: 'unavailable', reason: 'invalid-output' },
    );
  let called = false;
  const result = await extractCandidates({
    source: { ...source, pages: [{ page: 1, text: 'x'.repeat(12001) }] },
    extractReport: async () => {
      called = true;
      return review;
    },
  });
  assert.equal(called, false);
  assert.deepEqual(result, { kind: 'unavailable', reason: 'invalid-input' });
});

test('synthetic missing fields remain missing through extraction', async () => {
  const result = await extractCandidates({
    source,
    extractReport: async () => ({
      ...review,
      candidates: [
        {
          ...review.candidates[0],
          fields: { ...fields, unit: null },
          missing: ['unit', 'category'],
        },
      ],
    }),
  });
  assert.equal(result.kind, 'review');
  if (result.kind === 'review')
    assert.equal(result.candidates[0]?.fields.unit, null);
});
