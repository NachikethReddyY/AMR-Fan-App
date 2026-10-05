import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSyntheticActivityProvider } from './activity-demo.ts';
import { activityAssessmentOutputSchema } from '../activity/submission-result-contract.ts';

test('synthetic activity provider returns bounded review data without retaining media', async () => {
  const source = new Uint8Array([255, 216, 255, 224, 1, 2, 3]);
  const result = await createSyntheticActivityProvider().assess(
    {
      description: 'MVP photo review',
      photos: [{ bytes: source, mime: 'image/jpeg' }],
    },
    new AbortController().signal,
  );
  assert.equal(source[0], 255);
  const parsed = activityAssessmentOutputSchema.safeParse(result);
  assert.ok(parsed.success);
  if (parsed.success) {
    assert.ok(parsed.data.evidenceScore >= 60);
    assert.ok(parsed.data.confidence > 0.5);
    assert.equal(parsed.data.modelVersion, 'amr-mvp-review-v1');
  }
});
