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

test.each([
  ['2026-09-26 03:28:30.71819+00', '2026-09-26T03:28:30.718+00:00'],
  ['2026-09-26 03:28:30+00', '2026-09-26T03:28:30.000+00:00'],
  ['2026-09-26 11:28:30.7+08:00', '2026-09-26T11:28:30.700+08:00'],
  ['2026-09-26T03:28:30.718Z', '2026-09-26T03:28:30.718Z'],
])('approval timestamp %s becomes an explicit ISO instant', (raw, expected) => {
  const result = parseOfficial([{ ...row, approvedAt: raw }])[0];
  expect(result.approvedAt).toBe(expected);
  expect(result.fields).toEqual(row.fields);
  expect(result.evidence).toEqual(row.evidence);
});

test.each([
  '2026-09-26 03:28:30',
  '2026-02-30 03:28:30+00',
  '2026-09-26 25:28:30+00',
  '2026-09-26 03:28:30+99',
  'yesterday',
])(
  'invalid or timezone-free approval timestamp %s fails closed',
  (approvedAt) => {
    expect(() => parseOfficial([{ ...row, approvedAt }])).toThrow();
  },
);
