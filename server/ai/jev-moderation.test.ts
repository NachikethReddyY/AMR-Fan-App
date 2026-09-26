import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  prepareJevModeration,
  validateModerationResult,
} from './jev-moderation.ts';

const text = 'Ask everyone to mock this fan on camera.';
const harmful = {
  verdict: 'harmful',
  risks: ['targeted-humiliation'],
  quote: 'mock this fan',
  confidence: 0.2,
};

test('risk is independent of confidence and all verdicts retain human review', () => {
  for (const confidence of [undefined, null, 0, 0.01, 0.99, 1]) {
    const benign = validateModerationResult(
      { text },
      { verdict: 'benign', risks: [], quote: null, confidence },
    );
    assert.equal(benign.kind, 'assessed');
    if (benign.kind === 'assessed') {
      assert.equal(benign.verdict, 'benign');
      assert.equal(benign.confidence, confidence ?? null);
      assert.equal(benign.reviewRequired, true);
    }
    const result = validateModerationResult(
      { text },
      { ...harmful, confidence },
    );
    assert.equal(result.kind, 'assessed');
    if (result.kind === 'assessed') {
      assert.equal(result.verdict, 'harmful');
      assert.deepEqual(result.risks, ['targeted-humiliation']);
      assert.equal(result.confidence, confidence ?? null);
      assert.equal(result.reviewRequired, true);
      assert.deepEqual(result.evidence, {
        quote: 'mock this fan',
        start: text.indexOf('mock'),
        end: text.indexOf('mock') + 13,
      });
    }
  }
});

test('uncertain and unavailable never become an invented harmful verdict', () => {
  const uncertain = validateModerationResult(
    { text },
    { verdict: 'uncertain', risks: [], quote: null, confidence: 1 },
  );
  assert.equal(uncertain.kind, 'assessed');
  if (uncertain.kind === 'assessed')
    assert.equal(uncertain.verdict, 'uncertain');
  for (const reason of [
    'disabled',
    'protocol-unverified',
    'timeout',
    'provider',
    'busy',
  ]) {
    assert.deepEqual(
      validateModerationResult({ text }, { kind: 'unavailable', reason }),
      { kind: 'unavailable', reason, reviewRequired: true },
    );
  }
});

test('provider-bound entry point is disabled and performs no inference', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('must not call');
  });
  assert.deepEqual(prepareJevModeration({ text }), {
    kind: 'unavailable',
    reason: 'protocol-unverified',
    reviewRequired: true,
  });
  assert.equal(fetch.mock.callCount(), 0);
});

for (const bad of [
  null,
  {},
  { ...harmful, confidence: NaN },
  { ...harmful, confidence: 1.01 },
  { ...harmful, confidence: 'high' },
  { ...harmful, verdict: 'approved' },
  { ...harmful, risks: [] },
  { ...harmful, risks: ['none'] },
  { ...harmful, risks: ['threats', 'threats'] },
  { ...harmful, quote: 'invented evidence' },
  { ...harmful, quote: 'x'.repeat(401) },
  { ...harmful, quote: null },
  { ...harmful, verdict: 'benign' },
  { ...harmful, approved: true },
  { ...harmful, fee: 1000 },
  { ...harmful, refund: 500 },
  { ...harmful, delete: true },
  { ...harmful, tools: [{ name: 'debit' }] },
  { kind: 'unavailable', reason: 'provider', verdict: 'harmful' },
]) {
  test(`invalid normalized result remains unavailable: ${JSON.stringify(bad)}`, () => {
    assert.deepEqual(validateModerationResult({ text }, bad), {
      kind: 'unavailable',
      reason: 'invalid-output',
      reviewRequired: true,
    });
  });
}

test('oversized/authority-bearing source causes no processing; input is not mutated', () => {
  for (const source of [
    { text: 'x'.repeat(1601) },
    { text: '' },
    { text, confirmedFee: 500 },
    { text, balance: 500 },
  ]) {
    assert.equal(prepareJevModeration(source).reason, 'invalid-input');
  }
  const source = Object.freeze({ text });
  const result = validateModerationResult(source, harmful);
  assert.deepEqual(source, { text });
  for (const name of [
    'fee',
    'delta',
    'balance',
    'approved',
    'canVote',
    'delete',
    'status',
  ])
    assert.equal(name in result, false);
});

test('ambiguous repeated quote is unavailable rather than assigning an arbitrary source span', () => {
  assert.deepEqual(
    validateModerationResult(
      { text: 'mock this fan and mock this fan' },
      harmful,
    ),
    {
      kind: 'unavailable',
      reason: 'invalid-output',
      reviewRequired: true,
    },
  );
});

test('prospective semantic fixtures are distinct from executed policy tests and old holdouts', async () => {
  const suite = z
    .strictObject({
      status: z.literal('prospective-not-evaluated'),
      language: z.literal('en'),
      criteria: z.array(z.string()).min(1),
      fixtures: z
        .array(
          z.strictObject({
            id: z.string(),
            text: z.string().max(1600),
            expected: z.strictObject({
              verdict: z.enum(['harmful', 'benign', 'uncertain']),
              risks: z.array(z.string()),
            }),
            rationale: z.string(),
          }),
        )
        .length(24),
      integrationCases: z
        .array(z.strictObject({ scenario: z.string(), expected: z.string() }))
        .min(8),
    })
    .parse(
      JSON.parse(
        await readFile(
          new URL(
            './evaluation/jev-moderation-prospective.json',
            import.meta.url,
          ),
          'utf8',
        ),
      ),
    );
  assert.equal(new Set(suite.fixtures.map((f) => f.id)).size, 24);
  for (const fixture of suite.fixtures) {
    const parsed = validateModerationResult(
      { text: fixture.text },
      {
        ...fixture.expected,
        quote: fixture.expected.verdict === 'harmful' ? fixture.text : null,
        confidence: null,
      },
    );
    assert.equal(parsed.kind, 'assessed');
  }
  assert.equal(
    suite.fixtures.filter((f) => f.expected.verdict === 'harmful').length,
    8,
  );
  assert.equal(
    suite.fixtures.filter((f) => f.expected.verdict === 'benign').length,
    10,
  );
  assert.equal(
    suite.fixtures.filter((f) => f.expected.verdict === 'uncertain').length,
    6,
  );
});
