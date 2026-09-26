import { parseOfficial } from './contracts';
import { createOfficialApi } from './api';
const id = '10000000-0000-4000-8000-000000000001';
const span = { text: 'Literal 1,000', start: 0, end: 13 };
const row = {
  approvalId: id,
  candidateId: id,
  documentId: id,
  title: 'Synthetic report',
  sourceKind: 'synthetic',
  sha256: 'a'.repeat(64),
  parserVersion: 'fixture',
  reviewerId: id,
  approvedAt: '2026-09-26 00:00:00+00',
  fields: {
    name: span,
    value: span,
    unit: span,
    period: span,
    category: null,
    meaning: span,
    method: null,
  },
  evidence: { page: 1, quote: 'Literal 1,000', start: 0, end: 13 },
  missing: ['category', 'method'],
  period: 'Literal 1,000',
};
test('approved figures retain literal values, provenance, missing fields without aggregation', () => {
  const value = parseOfficial([row]);
  expect(value[0].fields.value?.text).toBe('Literal 1,000');
  expect(value[0].fields.method).toBeNull();
  expect(() => parseOfficial([{ ...row, approvalId: null }])).toThrow();
  expect(() =>
    parseOfficial([{ ...row, fields: { ...row.fields, value: null } }]),
  ).toThrow();
});
test('official adapter uses only authenticated approved endpoint and never substitutes error with zero', async () => {
  const request = jest.fn(async () => [row]);
  const result = await createOfficialApi(request)({
    token: 'A',
    profileId: id,
  });
  expect(request).toHaveBeenCalledWith('/v1/impact/official', 'A');
  expect(result.items).toHaveLength(1);
});
