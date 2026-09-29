import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAi } from './index.ts';

for (const number of [
  '-50',
  '−50',
  '− 50',
  '+50',
  '.50',
  '1,500',
  '1 500',
  '1\u202f500',
  '1\u00a0500',
  '1.500',
]) {
  for (const full of [false, true]) {
    test(`${full ? 'preserves' : 'rejects a fragment of'} numeric token ${JSON.stringify(number)}`, async (t) => {
      const value = full ? number : number.includes('500') ? '500' : '50';
      const quote = `Water change was ${number} m3.`;
      t.mock.method(globalThis, 'fetch', async () =>
        Response.json({
          model: 'gpt-6-luna',
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      name: 'Water change',
                      value,
                      unit: 'm3',
                      period: null,
                      category: null,
                      meaning: null,
                      evidence: { page: 1, quote },
                    },
                  ],
                }),
              },
            },
          ],
        }),
      );
      const ai = createAi({
        LUNA_API_KEY: 'synthetic-only',
        LUNA_REPORT_EXTRACTION_ENABLED: true,
      });
      const text = `  ${quote}  `;
      const result = await ai.extractReport({
        permission: 'synthetic',
        documentId: 'numeric',
        pages: [{ page: 1, text }],
      });
      if (!full) {
        assert.deepEqual(result, {
          kind: 'unavailable',
          reason: 'ungrounded',
          reviewRequired: true,
        });
      } else {
        assert.equal(result.kind, 'review');
        if (result.kind !== 'review') return;
        const span = result.candidates[0]?.fields.value;
        assert.deepEqual(span, {
          text: value,
          start: text.indexOf(value),
          end: text.indexOf(value) + value.length,
        });
      }
    });
  }
}

test('the leading digits of a grouped number are not a complete value', async (t) => {
  const quote = 'Water use was 1 500 m3.';
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      model: 'gpt-6-luna',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              candidates: [
                {
                  name: 'Water use',
                  value: '1',
                  unit: 'm3',
                  period: null,
                  category: null,
                  meaning: null,
                  evidence: { page: 1, quote },
                },
              ],
            }),
          },
        },
      ],
    }),
  );
  const ai = createAi({
    LUNA_API_KEY: 'synthetic-only',
    LUNA_REPORT_EXTRACTION_ENABLED: true,
  });
  assert.deepEqual(
    await ai.extractReport({
      permission: 'synthetic',
      documentId: 'prefix',
      pages: [{ page: 1, text: quote }],
    }),
    {
      kind: 'unavailable',
      reason: 'ungrounded',
      reviewRequired: true,
    },
  );
});

test('a quote cropped inside a numeric source token cannot hide its sign or grouping', async (t) => {
  for (const number of ['−50', '1\u202f500']) {
    const value = number.includes('500') ? '500' : '50';
    t.mock.method(globalThis, 'fetch', async () =>
      Response.json({
        model: 'gpt-6-luna',
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                candidates: [
                  {
                    name: null,
                    value,
                    unit: 'm3',
                    period: null,
                    category: null,
                    meaning: null,
                    evidence: { page: 1, quote: `${value} m3.` },
                  },
                ],
              }),
            },
          },
        ],
      }),
    );
    const ai = createAi({
      LUNA_API_KEY: 'synthetic-only',
      LUNA_REPORT_EXTRACTION_ENABLED: true,
    });
    const result = await ai.extractReport({
      permission: 'synthetic',
      documentId: 'cropped',
      pages: [{ page: 1, text: `Water change was ${number} m3.` }],
    });
    assert.deepEqual(result, {
      kind: 'unavailable',
      reason: 'ungrounded',
      reviewRequired: true,
    });
    t.mock.restoreAll();
  }
});
