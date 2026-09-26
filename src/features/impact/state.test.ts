import { contributionText } from './presentation';
import { createResource } from '../account/resource';
import { parseOfficial, parseContributions } from './contracts';
import { createOfficialApi, createContributionApi } from './api';
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

test('contribution API validates distinct empty/unavailable states and never replaces errors with zero', async () => {
  const payload = {
    period: 'lifetime',
    unit: 'kgCO2e',
    sources: [],
    validation: [],
    personal: { kind: 'empty' },
    community: { kind: 'unavailable', reasons: ['validation_pending'] },
  };
  const request = jest.fn(async () => payload);
  const result = await createContributionApi(request)({
    token: 'A',
    profileId: id,
  });
  expect(request).toHaveBeenCalledWith(`/v1/profiles/${id}/impact`, 'A');
  expect(result.items[0].personal).toEqual({ kind: 'empty' });
  const broken = createContributionApi(async () => {
    throw new Error('offline');
  });
  await expect(broken({ token: 'A', profileId: id })).rejects.toThrow(
    'offline',
  );
});

test('contribution contract preserves exact kg and rejects fake units and malformed values', async () => {
  const payload = {
    period: 'lifetime',
    unit: 'kgCO2e',
    sources: [],
    validation: [],
    personal: {
      kind: 'available',
      savingsKg: '0.3',
      journeyCount: 2,
      excludedJourneys: 0,
    },
    community: {
      kind: 'available',
      savingsKg: '9',
      journeyCount: 3,
      excludedJourneys: 0,
    },
  };
  expect(parseContributions(payload).personal).toEqual(payload.personal);
  expect(() => parseContributions({ ...payload, unit: 'points' })).toThrow();
  expect(() =>
    parseContributions({
      ...payload,
      personal: { ...payload.personal, savingsKg: '-1' },
    }),
  ).toThrow();
  expect(() =>
    parseContributions({
      ...payload,
      personal: { kind: 'empty', savingsKg: '0' },
    }),
  ).toThrow();
});

test('presentation distinguishes sign-in, loading, empty, blocked, errors and true zero', () => {
  expect(contributionText(null)).toBe('Sign in to view impact.');
  expect(contributionText({ kind: 'loading' })).toBe('Loading impact…');
  expect(contributionText({ kind: 'error', error: 'offline' })).toBe(
    'Impact unavailable. Open Impact to retry.',
  );
  const state = (
    personal: ReturnType<typeof parseContributions>['personal'],
  ) => ({
    kind: 'ready' as const,
    items: [
      {
        id,
        period: 'lifetime' as const,
        unit: 'kgCO2e' as const,
        personal,
        community: { kind: 'empty' as const },
        sources: [],
        validation: [],
      },
    ],
    nextCursor: null,
    busy: false,
    error: null,
  });
  expect(contributionText(state({ kind: 'empty' }))).toBe(
    'No qualifying journeys yet.',
  );
  expect(
    contributionText(
      state({ kind: 'unavailable', reasons: ['validation_pending'] }),
    ),
  ).toContain('validation pending');
  expect(
    contributionText(
      state({
        kind: 'available',
        savingsKg: '0',
        journeyCount: 1,
        excludedJourneys: 0,
      }),
    ),
  ).toBe('0 kg CO₂e estimated savings · Lifetime');
});

test('contribution resource discards an old account response after profile switch and logout', async () => {
  let complete: ((value: unknown) => void) | undefined;
  const request = jest.fn(
    () =>
      new Promise<unknown>((resolve) => {
        complete = resolve;
      }),
  );
  const controller = createResource(createContributionApi(request), jest.fn());
  const pending = controller.setContext({ token: 'A', profileId: id });
  await controller.setContext(null);
  complete?.({
    period: 'lifetime',
    unit: 'kgCO2e',
    personal: { kind: 'empty' },
    community: { kind: 'empty' },
    sources: [],
    validation: [],
  });
  await pending;
  expect(controller.getState()).toEqual({ kind: 'idle' });
});
