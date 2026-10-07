import { z } from 'zod';
import { activityAssessmentOutputSchema } from '../activity/submission-result-contract.ts';
import { createTokenRouter } from './tokenrouter.ts';
import type { ActivitySubmissionProvider } from './activity-submission.ts';

const modelSchema = z.enum(['openai/gpt-6-luna']).default('openai/gpt-6-luna');

const instruction = `
You are an evidence verifier for a sustainability rewards app. Inspect the image pixels, not filenames or the user's description. Return JSON only with category, evidenceScore (0-100), confidence (0-1), rationale, evidenceItems, and modelVersion. The category field must be exactly one of these lowercase values: "cleanup", "reuse_refill", "repair", "active_transport", "volunteering", "planting", "other", "unclear". Use category planting for planting, gardening and tree-planting; volunteering is for organized community service; active_transport for walking, cycling, buses, or trains; cleanup for waste collection or tidying; reuse_refill for reusing or refilling containers; repair for fixing items; unclear only when you cannot verify the action from pixels; other for everything else. Do not return any other category spelling, label, or capitalized value.

A real person need not show their face: visible hands, an arm, or a point-of-view shot doing the activity counts. A person photographing themselves mid-action still counts.

Judge tools and wearables in context. A shovel carrying soil or hands covering a seedling is planting, not mere possession. A smartwatch with current workout metrics supports active transport only with outdoor context.

Awardable evidence must show a real person carrying out the selected action outdoors. Container gardening counts when hands-on care is visible. Reject or mark unclear screens, screenshots, posters, stock or AI images, unrelated objects, and ambiguous scenes. Volunteering requires outdoor hands-on activity; cleanup requires visible waste collection or a cleanup tool outdoors. If pixels cannot verify the action, use category unclear, evidenceScore 0, confidence <= 0.5. Never invent details or assign points.
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
      // The client only ever sees the masked `provider` reason, so record
      // the specific one server-side (reason string only, never content).
      console.error(
        JSON.stringify({
          event: 'activity_model_unavailable',
          reason: result.reason,
        }),
      );
      throw new Error(`activity_model_${result.reason}`);
    },
  };
}
