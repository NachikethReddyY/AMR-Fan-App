import { createHash } from 'node:crypto';
import type { ActivitySubmissionProvider } from './activity-submission.ts';

const categories = ['active_transport', 'cleanup', 'reuse_refill'] as const;

/**
 * Local MVP provider. It fingerprints the transient canonical image and emits
 * a bounded review candidate without retaining or inspecting the original
 * pixels. Replace this adapter with a reviewed vision provider before launch.
 */
export function createSyntheticActivityProvider(): ActivitySubmissionProvider {
  return {
    async assess({ photos }, signal) {
      if (signal.aborted) throw signal.reason ?? new Error('cancelled');
      const digest = createHash('sha256')
        .update(photos[0]?.bytes ?? new Uint8Array())
        .digest();
      const category = categories[digest[0] % categories.length];
      const evidenceScore = 60 + (digest[1] % 41);
      const confidence = 0.7 + (digest[2] / 255) * 0.25;
      digest.fill(0);
      return {
        category,
        evidenceScore,
        confidence,
        rationale: 'MVP activity review completed for the submitted photo.',
        evidenceItems: ['Submitted photo received for sustainability review.'],
        modelVersion: 'amr-mvp-review-v1',
      };
    },
  };
}
