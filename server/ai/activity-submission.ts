import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  clearCanonicalActivitySubmission,
  type CanonicalActivitySubmission,
} from '../activity/canonicalize.ts';
import {
  activityAssessmentOutputSchema,
  activitySubmissionAssessmentResultSchema,
  type ActivitySubmissionAssessmentResult,
} from '../activity/submission-result-contract.ts';

export type ActivitySubmissionProvider = {
  assess: (
    input: {
      description: string;
      photos: readonly { bytes: Uint8Array; mime: 'image/jpeg' }[];
    },
    signal: AbortSignal,
  ) => Promise<unknown>;
};

export { activitySubmissionAssessmentResultSchema };
export type { ActivitySubmissionAssessmentResult };
const policyVersion = 'activity-evidence-v1' as const;

function unavailable(
  reason: Extract<
    ActivitySubmissionAssessmentResult,
    { kind: 'unavailable' }
  >['reason'],
): ActivitySubmissionAssessmentResult {
  return { kind: 'unavailable', reason };
}

/** Provider boundary for one canonicalized multi-photo submission. */
export function createActivitySubmissionAssessor({
  provider,
  timeoutMs = 8000,
  id = randomUUID,
}: {
  provider?: ActivitySubmissionProvider;
  timeoutMs?: number;
  id?: () => string;
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 8000)
    throw new Error('Invalid activity provider timeout');
  let active = false;
  return {
    async assess(
      submission: CanonicalActivitySubmission,
      signal?: AbortSignal,
      onSettled?: () => void,
    ): Promise<ActivitySubmissionAssessmentResult> {
      let notified = false;
      const notifySettled = () => {
        if (notified) return;
        notified = true;
        onSettled?.();
      };
      if (!provider) {
        clearCanonicalActivitySubmission(submission);
        notifySettled();
        return unavailable('disabled');
      }
      if (active) {
        clearCanonicalActivitySubmission(submission);
        notifySettled();
        return unavailable('busy');
      }
      if (signal?.aborted) {
        clearCanonicalActivitySubmission(submission);
        notifySettled();
        return signal.reason === 'timeout'
          ? unavailable('timeout')
          : { kind: 'cancelled', reason: 'request_cancelled' };
      }

      active = true;
      const controller = new AbortController();
      let deadline: ReturnType<typeof setTimeout> | undefined;
      let removeAbort: (() => void) | undefined;
      let stopResult: ActivitySubmissionAssessmentResult | undefined;
      const clearBuffers = () => clearCanonicalActivitySubmission(submission);
      const stop = (
        result: ActivitySubmissionAssessmentResult,
        reason: 'timeout' | 'cancelled',
      ) => {
        if (stopResult) return;
        stopResult = result;
        controller.abort(reason);
        if (deadline) clearTimeout(deadline);
        deadline = undefined;
        removeAbort?.();
        removeAbort = undefined;
        // Keep active and the media buffers until an abort-ignoring provider
        // settles. This adapter cannot safely be enabled for live traffic.
      };
      const stopped = new Promise<ActivitySubmissionAssessmentResult>(
        (resolve) => {
          const cancel = () => {
            const timedOut = signal?.reason === 'timeout';
            const result = timedOut
              ? unavailable('timeout')
              : ({ kind: 'cancelled', reason: 'request_cancelled' } as const);
            stop(result, timedOut ? 'timeout' : 'cancelled');
            resolve(result);
          };
          removeAbort = () => signal?.removeEventListener('abort', cancel);
          if (signal?.aborted) cancel();
          else {
            signal?.addEventListener('abort', cancel, { once: true });
            deadline = setTimeout(() => {
              const result = unavailable('timeout');
              stop(result, 'timeout');
              resolve(result);
            }, timeoutMs);
          }
        },
      );
      const work = (async () => {
        try {
          if (controller.signal.aborted)
            return (
              stopResult ??
              ({ kind: 'cancelled', reason: 'request_cancelled' } as const)
            );
          const output = await provider.assess(
            {
              description: submission.description,
              photos: submission.photos.map((photo) => ({
                bytes: photo.bytes,
                mime: 'image/jpeg' as const,
              })),
            },
            controller.signal,
          );
          if (controller.signal.aborted)
            return (
              stopResult ??
              ({ kind: 'cancelled', reason: 'request_cancelled' } as const)
            );
          const parsed = activityAssessmentOutputSchema.safeParse(output);
          if (!parsed.success) return unavailable('invalid_output');
          const value = parsed.data;
          if (
            value.category === 'other' ||
            value.category === 'unclear' ||
            value.confidence <= 0.5
          )
            return {
              kind: 'uncertain' as const,
              reason:
                value.category === 'other' || value.category === 'unclear'
                  ? ('unclear' as const)
                  : ('low_confidence' as const),
            };
          if (value.evidenceScore < 60)
            return {
              kind: 'rejected' as const,
              reason: 'unsupported_activity' as const,
            };
          return {
            kind: 'accepted' as const,
            assessmentId: z.uuid().parse(id()),
            ...value,
            policyVersion,
          };
        } catch {
          return controller.signal.aborted
            ? (stopResult ??
                ({ kind: 'cancelled', reason: 'request_cancelled' } as const))
            : unavailable('provider');
        } finally {
          active = false;
          if (deadline) clearTimeout(deadline);
          removeAbort?.();
          clearBuffers();
          notifySettled();
        }
      })();
      // A never-settling provider intentionally keeps active true until settle.
      return Promise.race([work, stopped]);
    },
  };
}
