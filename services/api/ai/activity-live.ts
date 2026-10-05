import { z } from 'zod';
import { activityAssessmentOutputSchema } from '../activity/submission-result-contract.ts';
import { createTokenRouter } from './tokenrouter.ts';
import type { ActivitySubmissionProvider } from './activity-submission.ts';

const modelSchema = z.enum(['openai/gpt-6-luna']).default('openai/gpt-6-luna');

const instruction = `
You are an evidence verifier for a sustainability rewards app. Inspect the image pixels, not filenames or the user's description. Return JSON only with category, evidenceScore (0-100), confidence (0-1), rationale, evidenceItems, and modelVersion.

Awardable evidence must show a real person carrying out the selected action in the real world. Reject or mark unclear when the image is a phone/computer/TV screen, screenshot, poster, stock or AI image, indoor or potted planting, an unrelated object, or an ambiguous scene. Planting and volunteering require an outdoor setting and visible hands-on activity. Cleanup requires visible waste collection or a cleanup tool and a real outdoor setting. A screen showing planting, cleanup, or people is still invalid. If you cannot verify the action from pixels, use category unclear, evidenceScore 0, confidence <= 0.5. Never invent details and never assign points.
`.trim();

export function createTokenRouterActivityProvider(
  env: Record<string, string | undefined>,
): ActivitySubmissionProvider {
  const model = modelSchema.parse(env.LUNA ?? 'openai/gpt-6-luna');
  const router = createTokenRouter({
    AI_API_KEY: env.AI_API_KEY,
    AI_BASE_URL: env.AI_BASE_URL,
    TOKENROUTER_API_KEY: env.TOKENROUTER_API_KEY,
    TOKENROUTER_BASE_URL: env.TOKENROUTER_BASE_URL,
    TOKENROUTER_ENABLED:
      env.TOKENROUTER_ENABLED ?? env.AI_API_KEY !== undefined,
  });
  return {
    async assess(input, signal) {
      const result = await router.complete(
        {
          model,
          permission: 'permitted',
          instruction,
          input:
            input.description.trim() ||
            'No user description. Use image evidence only.',
          images: input.photos.map((photo) => ({
            mime: photo.mime,
            base64: Buffer.from(photo.bytes).toString('base64'),
          })),
        },
        activityAssessmentOutputSchema,
        signal,
      );
      if (result.kind === 'candidate') return result.value;
      throw new Error(`activity_model_${result.reason}`);
    },
  };
}
