import { z } from 'zod';
import { activityAssessmentOutputSchema } from '../activity/submission-result-contract.ts';
import { createTokenRouter } from './tokenrouter.ts';
import type { ActivitySubmissionProvider } from './activity-submission.ts';

const modelSchema = z.enum(['openai/gpt-6-luna']).default('openai/gpt-6-luna');

const instruction = `
You are an evidence verifier for a sustainability rewards app. Inspect the image pixels, not filenames or the user's description. Return JSON only with category, evidenceScore (0-100), confidence (0-1), rationale, evidenceItems, and modelVersion. The category field must be exactly one of these lowercase values: "cleanup", "reuse_refill", "repair", "active_transport", "volunteering", "planting", "other", "unclear". Use category planting for planting, gardening and tree-planting; volunteering is for organized community service; active_transport for walking, cycling, buses, or trains; cleanup for waste collection or tidying; reuse_refill for reusing or refilling containers; repair for fixing items; unclear only when you cannot verify the action from pixels; other for everything else. Do not return any other category spelling, label, or capitalized value.

A real person need not show their face: a visible hand, arm, or point-of-view shot of someone doing the activity counts as the person being present. Someone photographing themselves mid-action is still the person carrying it out.

Judge tools and wearables by their context, not as isolated objects. A shovel carrying soil at a planting site, or hands covering a seedling, is planting activity, not mere possession of a shovel. A smartwatch or fitness display showing a live workout with current metrics corroborates active transport; without outdoor context it stays unclear.

Awardable evidence must show a real person carrying out the selected action in the real world. Container gardening counts as planting: tending real growing plants in pots, planters, or on balconies is awardable activity when hands-on care is visible. Reject or mark unclear when the image is a phone/computer/TV screen, screenshot, poster, stock or AI image, an unrelated object, or an ambiguous scene. Volunteering still requires an outdoor setting with visible hands-on activity. Cleanup requires visible waste collection or a cleanup tool and a real outdoor setting. A screen showing planting, cleanup, or people is still invalid. If you cannot verify the action from pixels, use category unclear, evidenceScore 0, confidence <= 0.5. Never invent details and never assign points.
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
