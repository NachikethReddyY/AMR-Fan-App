import type {
  ActivityAssessmentResult,
  ActivityRecovery,
  ActivitySubmissionInput,
} from './api';
import type { Photo } from './capture';
import { randomUUID } from 'expo-crypto';

export type ActivityResult = { kind: 'unavailable'; creditedPoints: 0 };
type AttemptResult = ActivityAssessmentResult | ActivityResult;
export type ActivityPhoto = Photo & { id: string };
export type ActivityState =
  | {
      kind:
        'idle' | 'checking_capability' | 'requesting_permission' | 'capturing';
    }
  | {
      kind: 'review';
      photos: ActivityPhoto[];
      description: string;
      missionId: string | null;
    }
  | {
      kind: 'submitting';
      requestId: string;
      photos: ActivityPhoto[];
      description: string;
      missionId: string | null;
    }
  | { kind: 'result'; result: ActivityAssessmentResult | ActivityRecovery }
  | { kind: 'outcome_unconfirmed'; requestId: string }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'error'; message: string };

export function duplicatePhoto(
  photos: readonly ActivityPhoto[],
  base64: string,
) {
  return photos.some((photo) => photo.base64 === base64);
}
export function validDescription(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 1600;
}
export function createRequestId() {
  return randomUUID();
}

type Input =
  | {
      photos: ActivityPhoto[];
      description: string;
      missionId: string | null;
      requestId?: string;
    }
  | {
      photo: Photo;
      description: string;
      bus: { start: string; destination: string } | null;
    };
export function createActivityAttempt(
  send?: (
    input: ActivitySubmissionInput,
    signal: AbortSignal,
  ) => Promise<AttemptResult>,
) {
  let pending: { controller: AbortController; input: Input } | undefined;
  return {
    cancel() {
      pending?.controller.abort();
      if (pending) {
        if ('photos' in pending.input)
          pending.input.photos.forEach((photo) => (photo.base64 = ''));
        else pending.input.photo.base64 = '';
        pending.input.description = '';
      }
      pending = undefined;
    },
    async submit(
      input: Input,
      currentSend = send,
    ): Promise<AttemptResult | null> {
      if (!currentSend) throw new Error('Activity check is unavailable.');
      if (pending) throw new Error('An activity check is already in progress.');
      const current = { controller: new AbortController(), input };
      pending = current;
      const stopped = new Promise<null>((resolve) =>
        current.controller.signal.addEventListener(
          'abort',
          () => resolve(null),
          { once: true },
        ),
      );
      const timeout = setTimeout(
        () => current.controller.abort('timeout'),
        20_000,
      );
      try {
        const normalized =
          'photos' in input
            ? input
            : {
                photos: [{ ...input.photo, id: 'legacy' }],
                description: input.description,
                missionId: null,
              };
        const payload: ActivitySubmissionInput = {
          requestId: normalized.requestId ?? createRequestId(),
          description: normalized.description.trim(),
          missionId: normalized.missionId,
          photos: normalized.photos.map(({ mime, base64 }) => ({
            mime,
            base64,
          })),
        };
        const result = await Promise.race([
          currentSend(payload, current.controller.signal),
          stopped,
        ]);
        return current.controller.signal.aborted ? null : result;
      } finally {
        clearTimeout(timeout);
        if ('photos' in current.input)
          current.input.photos.forEach((photo) => (photo.base64 = ''));
        else current.input.photo.base64 = '';
        current.input.description = '';
        if (pending === current) pending = undefined;
      }
    },
  };
}
