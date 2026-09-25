import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCandidate, requireApproval } from './contracts.ts';

const text =
  'Synthetic report. Water use result: 1,250 litres in 2025. Method: meter readings.';
const input = {
  name: 'Water use',
  value: '1,250',
  unit: 'litres',
  period: '2025',
  category: null,
  meaning: 'result',
  method: 'meter readings',
  evidence: { page: 1, start: 18, end: text.length, quote: text.slice(18) },
};

test('review preserves literal value and exact source evidence without inventing a category', () => {
  const candidate = validateCandidate(input, [{ page: 1, text }]);
  assert.equal(candidate.fields.value?.text, '1,250');
  assert.deepEqual(candidate.fields.value, {
    text: '1,250',
    start: 36,
    end: 41,
  });
  assert.equal(candidate.fields.category, null);
  assert.deepEqual(candidate.missing, ['category']);
  assert.deepEqual(candidate.evidence, input.evidence);
  assert.doesNotThrow(() => requireApproval(candidate));
});

test('missing required fields remain review-needed; method/category gaps stay explicit', () => {
  for (const field of ['name', 'value', 'unit', 'period', 'meaning']) {
    const candidate = validateCandidate({ ...input, [field]: null }, [
      { page: 1, text },
    ]);
    assert.ok(candidate.missing.includes(field));
    assert.throws(() => requireApproval(candidate), /required fields/);
  }
  const unsupportedMeaning = validateCandidate(
    { ...input, meaning: 'Water use' },
    [{ page: 1, text }],
  );
  assert.throws(() => requireApproval(unsupportedMeaning), /required fields/);
  const missingMethod = validateCandidate({ ...input, method: null }, [
    { page: 1, text },
  ]);
  assert.ok(missingMethod.missing.includes('method'));
  assert.doesNotThrow(() => requireApproval(missingMethod));
});

test('invented provenance, partial numbers and approval fields are rejected', () => {
  for (const change of [
    { value: '250' },
    { value: '1' },
    { unit: 'kg' },
    { approvedBy: 'admin' },
    { evidence: { ...input.evidence, page: 2 } },
    { evidence: { ...input.evidence, start: 0 } },
    { value: Number.POSITIVE_INFINITY },
  ])
    assert.throws(() =>
      validateCandidate({ ...input, ...change }, [{ page: 1, text }]),
    );
  const signed = 'result: −1,250 litres in 2025';
  assert.throws(
    () =>
      validateCandidate(
        {
          ...input,
          name: null,
          method: null,
          evidence: { page: 1, start: 0, end: signed.length, quote: signed },
        },
        [{ page: 1, text: signed }],
      ),
    /complete literal/,
  );
});
