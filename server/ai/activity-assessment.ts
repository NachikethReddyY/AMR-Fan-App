import { z } from 'zod';
import {
  activityAssessmentOutputSchema,
  type ActivityAssessmentOutput,
} from '../activity/submission-result-contract.ts';
export {
  activityAssessmentOutputSchema,
  activityCategories,
} from '../activity/submission-result-contract.ts';
export type { ActivityAssessmentOutput } from '../activity/submission-result-contract.ts';

/** Validate the untrusted provider boundary; unknown keys are rejected. */
export function validateActivityAssessmentOutput(
  value: unknown,
): ActivityAssessmentOutput {
  return activityAssessmentOutputSchema.parse(value);
}

const inputSchema = z.strictObject({
  photo: z
    .instanceof(Uint8Array)
    .refine((value) => value.byteLength > 0 && value.byteLength <= 2_000_000),
  mime: z.enum(['image/jpeg', 'image/png']),
  capture: z.literal('camera'),
  description: z.string().min(1).max(1600).regex(/\S/u),
  fingerprint: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
  eligibility: z.strictObject({
    eligible: z.boolean(),
    duplicate: z.boolean(),
    actionAlreadyRewarded: z.boolean(),
    tripAlreadyRewarded: z.boolean(),
  }),
});
const observationSchema = z.strictObject({
  observations: z.array(z.string().min(1).max(400).regex(/\S/u)).min(1).max(8),
});
const decisionSchema = z.strictObject({
  verdict: z.enum(['supported', 'not-supported', 'uncertain']),
  activity: z.enum(['bus-trip', 'other']),
  confidence: z.number().finite().min(0).max(1).nullable(),
});
type Observation = z.infer<typeof observationSchema>;
type Media = Pick<
  z.infer<typeof inputSchema>,
  'photo' | 'mime' | 'description'
>;
export type ActivityProvider = {
  observe: (media: Media, signal: AbortSignal) => Promise<unknown>;
  decide: (observations: Observation, signal: AbortSignal) => Promise<unknown>;
};
type Reason =
  | 'invalid-input'
  | 'invalid-output'
  | 'protocol-unverified'
  | 'provider'
  | 'busy'
  | 'timeout'
  | 'cancelled';
export type ActivityAssessmentResult =
  | { kind: 'unavailable'; reason: Reason }
  | { kind: 'ineligible' }
  | { kind: 'uncertain' | 'not-supported'; fingerprint: string }
  | {
      kind: 'candidate';
      activity: 'bus-trip' | 'other';
      confidence: number;
      fingerprint: string;
      requiresEligibilityRecheck: true;
    };

/** Server-owned, decoded media only. Consumes its mutable photo/description.
 * Injection is for a reviewed gateway mapper or synthetic fixtures, never a client.
 * No default provider, amount, persistence, daily limit or award authority.
 */
export function createActivityAssessment({
  provider,
  timeoutMs = 15000,
}: {
  provider?: ActivityProvider;
  timeoutMs?: number;
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 20000)
    throw new Error('Invalid activity timeout');
  let active = false;
  return {
    async assess(
      raw: unknown,
      signal?: AbortSignal,
    ): Promise<ActivityAssessmentResult> {
      const fail = (reason: Reason): ActivityAssessmentResult => ({
        kind: 'unavailable',
        reason,
      });
      let media: Media | undefined;
      let observations: Observation | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let cancel: (() => void) | undefined;
      try {
        const parsed = inputSchema.safeParse(raw);
        if (!parsed.success) return fail('invalid-input');
        const input = parsed.data;
        media = {
          photo: input.photo,
          mime: input.mime,
          description: input.description,
        };
        // Do not retain a second description copy while awaiting a provider.
        input.description = '';
        if (signal?.aborted) return fail('cancelled');
        const eligibility = input.eligibility;
        if (
          !eligibility.eligible ||
          eligibility.duplicate ||
          eligibility.actionAlreadyRewarded ||
          eligibility.tripAlreadyRewarded
        )
          return { kind: 'ineligible' };
        if (!provider) return fail('protocol-unverified');
        if (active) return fail('busy');
        active = true;
        const controller = new AbortController();
        const stopped = new Promise<ActivityAssessmentResult>((resolve) => {
          cancel = () => {
            controller.abort();
            resolve(fail('cancelled'));
          };
          signal?.addEventListener('abort', cancel, { once: true });
          timer = setTimeout(() => {
            controller.abort();
            resolve(fail('timeout'));
          }, timeoutMs);
        });
        const work = (async (): Promise<ActivityAssessmentResult> => {
          try {
            const seen = observationSchema.safeParse(
              await provider.observe(media, controller.signal),
            );
            if (controller.signal.aborted) return fail('cancelled');
            if (!seen.success) return fail('invalid-output');
            observations = seen.data;
            const decision = decisionSchema.safeParse(
              await provider.decide(observations, controller.signal),
            );
            if (controller.signal.aborted) return fail('cancelled');
            if (!decision.success) return fail('invalid-output');
            const { verdict, activity, confidence } = decision.data;
            if (verdict !== 'supported')
              return { kind: verdict, fingerprint: input.fingerprint };
            if (confidence === null || confidence <= 0.5)
              return { kind: 'uncertain', fingerprint: input.fingerprint };
            return {
              kind: 'candidate',
              activity,
              confidence,
              fingerprint: input.fingerprint,
              requiresEligibilityRecheck: true,
            };
          } catch {
            return fail('provider');
          } finally {
            // An abort-ignoring provider must not allow overlapping expensive calls.
            active = false;
          }
        })();
        return await Promise.race([work, stopped]);
      } finally {
        clearTimeout(timer);
        if (cancel) signal?.removeEventListener('abort', cancel);
        if (observations) observations.observations.fill('');
        if (media) {
          media.photo.fill(0);
          media.description = '';
        }
        if (raw && typeof raw === 'object') {
          if ('photo' in raw && raw.photo instanceof Uint8Array)
            raw.photo.fill(0);
          if ('description' in raw && typeof raw.description === 'string')
            raw.description = '';
        }
      }
    },
  };
}
