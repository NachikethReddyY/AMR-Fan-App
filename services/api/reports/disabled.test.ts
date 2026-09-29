import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAi } from '../ai/index.ts';
import { extractCandidates } from './extraction.ts';

test('unchanged AI default returns disabled without a provider request', async () => {
  const ai = createAi({});
  const result = await extractCandidates({
    source: {
      permission: 'synthetic',
      documentId: 'disabled-synthetic',
      pages: [{ page: 1, text: 'Water result 20 litres in 2025.' }],
    },
    extractReport: ai.extractReport,
  });
  assert.deepEqual(result, { kind: 'unavailable', reason: 'disabled' });
});
