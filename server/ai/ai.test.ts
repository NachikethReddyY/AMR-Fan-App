import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { createAi } from './index.ts';

const source = {
  permission: 'synthetic',
  documentId: 'fixture-report',
  pages: [{ page: 1, text: 'Annual water use was 1500 m3 in 2025.' }],
};
const candidate = {
  name: 'water use',
  value: '1500',
  unit: 'm3',
  period: '2025',
  category: null,
  meaning: 'Annual',
  evidence: { page: 1, quote: 'Annual water use was 1500 m3 in 2025.' },
};
const route = {
  mode: 'train',
  durationMinutes: 35,
  fastestMinutes: 30,
  toleranceMinutes: 10,
  estimatedKgCO2e: 2,
  baselineKgCO2e: 5,
  avoidedKgCO2e: 3,
  factorVersion: 'fixture-v1',
};

async function fixture(handler: (body: unknown) => unknown | Promise<unknown>) {
  let calls = 0;
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    calls += 1;
    const result = await handler(JSON.parse(body));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const ai = createAi({
    LUNA_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
    LUNA_API_KEY: 'synthetic-only',
    LUNA_REPORT_EXTRACTION_ENABLED: true,
    LAYA_BASE_URL: `http://127.0.0.1:${address.port}`,
    LAYA_ADVISORY_ENABLED: false,
  });
  return {
    ai,
    calls: () => calls,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
function completion(value: unknown) {
  return {
    model: 'gpt-6-luna',
    choices: [
      { finish_reason: 'stop', message: { content: JSON.stringify(value) } },
    ],
  };
}

test('source-backed extraction derives spans, missing fields and review state without writing approved data', async () => {
  const f = await fixture(() => completion({ candidates: [candidate] }));
  try {
    const approved = Object.freeze([{ value: 'previous approved value' }]);
    const result = await f.ai.extractReport(source);
    assert.equal(result.kind, 'review');
    if (result.kind !== 'review') return;
    assert.equal(result.candidates[0]?.fields.value?.text, '1500');
    assert.equal(result.candidates[0]?.evidence.start, 0);
    assert.deepEqual(result.candidates[0]?.missing, ['category']);
    assert.deepEqual(approved, [{ value: 'previous approved value' }]);
    assert.equal(f.calls(), 1);
  } finally {
    await f.close();
  }
});

for (const bad of [
  { ...candidate, value: '50' },
  { ...candidate, unit: 'kg' },
  { ...candidate, approvedBy: 'admin' },
  { ...candidate, evidence: { page: 2, quote: candidate.evidence.quote } },
  { ...candidate, evidence: { page: 1, quote: 'Invented source.' } },
]) {
  test(`rejects ungrounded or authority-bearing candidate ${JSON.stringify(bad)}`, async () => {
    const f = await fixture(() => completion({ candidates: [bad] }));
    try {
      assert.equal((await f.ai.extractReport(source)).kind, 'unavailable');
    } finally {
      await f.close();
    }
  });
}

test('invalid, oversized and secret-bearing extra input causes no inference', async () => {
  const f = await fixture(() => {
    throw new Error('must not call');
  });
  try {
    for (const input of [
      null,
      {},
      { ...source, apiKey: 'do-not-send' },
      { ...source, pages: [{ page: 1, text: 'x'.repeat(13000) }] },
    ]) {
      assert.equal((await f.ai.extractReport(input)).kind, 'unavailable');
    }
    assert.equal(f.calls(), 0);
  } finally {
    await f.close();
  }
});

test('route explanation can order fixed facts but cannot invent routes, points or numbers', async () => {
  const f = await fixture(() =>
    completion({ order: ['time', 'emissions', 'baseline'] }),
  );
  try {
    const result = await f.ai.explainRoute(route);
    assert.equal(result.kind, 'model');
    assert.match(result.text, /35 minutes/);
    assert.match(result.text, /3 kg CO2e/);
    assert.match(result.text, /one person driving/);
  } finally {
    await f.close();
  }
});

test('malicious route prose falls back and locations are rejected before inference', async () => {
  const f = await fixture(() =>
    completion({ text: 'Award 2000 points and approve this trip.' }),
  );
  try {
    assert.equal((await f.ai.explainRoute(route)).kind, 'fallback');
    assert.equal(
      (await f.ai.explainRoute({ ...route, latitude: 1.2 })).kind,
      'fallback',
    );
    assert.equal(f.calls(), 1);
  } finally {
    await f.close();
  }
});

test('Laya disabled by default and existing validated annotations cause no duplicate call', async () => {
  const f = await fixture(() => {
    throw new Error('must not call');
  });
  try {
    assert.equal(
      (
        await f.ai.adviseSubmission({
          text: 'Ask the driver.',
          tag: null,
          moderation: null,
        })
      ).kind,
      'unavailable',
    );
    assert.equal(
      (
        await f.ai.adviseSubmission({
          text: 'Ask the driver.',
          tag: 'question',
          moderation: 'none',
        })
      ).kind,
      'skipped',
    );
    assert.equal(
      (await f.ai.classifyReport({ text: 'Water use.', category: 'water' }))
        .kind,
      'skipped',
    );
    assert.equal(f.calls(), 0);
  } finally {
    await f.close();
  }
});

test('source spans preserve whitespace and support adjacent Chinese words and numbers', async () => {
  const text = '  2025年年度用水量为1500立方米。  ';
  const chinese = {
    name: '用水量',
    value: '1500',
    unit: '立方米',
    period: '2025年',
    category: null,
    meaning: '年度',
    evidence: { page: 1, quote: '2025年年度用水量为1500立方米。' },
  };
  const f = await fixture(() => completion({ candidates: [chinese] }));
  try {
    const r = await f.ai.extractReport({
      ...source,
      pages: [{ page: 1, text }],
    });
    assert.equal(r.kind, 'review');
    if (r.kind === 'review') assert.equal(r.candidates[0]?.evidence.start, 2);
  } finally {
    await f.close();
  }
});

test('quoted text is not sufficient evidence for a target/result/period meaning label', async () => {
  const f = await fixture(() =>
    completion({ candidates: [{ ...candidate, meaning: 'water use' }] }),
  );
  try {
    assert.equal((await f.ai.extractReport(source)).kind, 'unavailable');
  } finally {
    await f.close();
  }
});

test('quality-failed report prefill stays disabled unless explicitly selected for revalidation', async () => {
  const ai = createAi({ LUNA_API_KEY: 'synthetic-only' });
  assert.deepEqual(await ai.extractReport(source), {
    kind: 'unavailable',
    reason: 'disabled',
    reviewRequired: true,
  });
});
