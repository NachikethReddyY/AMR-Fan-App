import type { Pool } from 'pg';
import { ApiError } from '../accounts/types.ts';
import {
  canonicalizeActivitySubmission,
  clearCanonicalActivitySubmission,
} from './canonicalize.ts';
import { beginAssessment, completeAssessment } from './assessment-store.ts';
import { parseActivitySubmission } from './submission-contract.ts';
import {
  createActivitySubmissionAssessor,
  type ActivitySubmissionAssessmentResult,
  type ActivitySubmissionProvider,
} from '../ai/activity-submission.ts';
import { settleAcceptedActivity } from './rewards.ts';

export type ActivitySubmissionService = ReturnType<
  typeof createActivitySubmissionService
>;

export const DEFAULT_ACTIVITY_OPERATION_TIMEOUT_MS = 9500;

function stoppedResult(
  signal: AbortSignal,
): ActivitySubmissionAssessmentResult {
  return signal.reason === 'timeout'
    ? { kind: 'unavailable', reason: 'timeout' }
    : { kind: 'cancelled', reason: 'request_cancelled' };
}

function databaseUnavailableResult(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined;
  if (code === '55P03')
    return { kind: 'unavailable' as const, reason: 'busy' as const };
  if (code === '57014')
    return { kind: 'unavailable' as const, reason: 'timeout' as const };
  return undefined;
}

/**
 * Composes authenticated parsing, transient media canonicalization, durable
 * request-key ownership and the provider call. It intentionally has no points
 * or mission dependencies; Gate 2 owns those side effects.
 */
export function createActivitySubmissionService({
  pool,
  provider,
  timeoutMs = 8000,
  operationTimeoutMs = DEFAULT_ACTIVITY_OPERATION_TIMEOUT_MS,
  creditContext: configuredCreditContext,
}: {
  pool: Pool;
  provider?: ActivitySubmissionProvider;
  timeoutMs?: number;
  operationTimeoutMs?: number;
  creditContext?: 'production' | 'synthetic_test';
}) {
  const assessor = createActivitySubmissionAssessor({ provider, timeoutMs });
  let active = 0;
  const creditContext: 'production' | 'synthetic_test' =
    configuredCreditContext ??
    (process.env.NODE_ENV === 'test' ? 'synthetic_test' : 'production');

  if (
    !Number.isInteger(operationTimeoutMs) ||
    operationTimeoutMs < 100 ||
    operationTimeoutMs > 10000
  )
    throw new Error('Invalid activity operation timeout');

  async function submit(input: {
    principalId: string;
    profileId: string;
    token?: string;
    body: unknown;
    signal?: AbortSignal;
  }) {
    // Process-local admission precedes parsing and canonicalization. The
    // durable beginAssessment gate still coordinates multiple API instances.
    if (!provider)
      return {
        kind: 'result' as const,
        result: { kind: 'unavailable' as const, reason: 'disabled' as const },
      };
    if (active >= 1)
      return {
        kind: 'result' as const,
        result: { kind: 'unavailable' as const, reason: 'busy' as const },
      };
    active += 1;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        active -= 1;
      }
    };
    let canonical:
      Awaited<ReturnType<typeof canonicalizeActivitySubmission>> | undefined;
    let providerPending = false;
    let providerSettled = true;
    let requestDone = false;
    let startedId: string | undefined;
    try {
      if (input.signal?.aborted)
        return { kind: 'result' as const, result: stoppedResult(input.signal) };
      const parsed = parseActivitySubmission(input.body);
      if (input.signal?.aborted)
        return { kind: 'result' as const, result: stoppedResult(input.signal) };
      try {
        canonical = await canonicalizeActivitySubmission(parsed, input.signal);
      } catch (error) {
        if (input.signal?.aborted)
          return {
            kind: 'result' as const,
            result: stoppedResult(input.signal),
          };
        throw error;
      }
      if (input.signal?.aborted) {
        clearCanonicalActivitySubmission(canonical);
        canonical = undefined;
        return { kind: 'result' as const, result: stoppedResult(input.signal) };
      }

      const begun = await beginAssessment({
        pool,
        principalId: input.principalId,
        profileId: input.profileId,
        requestId: parsed.requestId,
        payloadDigest: canonical.payloadDigest,
        missionId: parsed.missionId,
        imageHashes: canonical.photos.map((photo) => photo.fingerprint),
      });
      if (input.signal?.aborted && begun.kind !== 'started') {
        clearCanonicalActivitySubmission(canonical);
        canonical = undefined;
        return { kind: 'result' as const, result: stoppedResult(input.signal) };
      }
      if (begun.kind === 'replay') {
        clearCanonicalActivitySubmission(canonical);
        canonical = undefined;
        return { kind: 'replay' as const, result: begun.result };
      }
      if (begun.kind === 'busy') {
        clearCanonicalActivitySubmission(canonical);
        canonical = undefined;
        return {
          kind: 'result' as const,
          result: { kind: 'unavailable' as const, reason: 'busy' as const },
        };
      }
      startedId = begun.id;
      if (input.signal?.aborted) {
        const stored = await completeAssessment({
          pool,
          id: startedId,
          payloadDigest: canonical.payloadDigest,
          result: stoppedResult(input.signal),
        });
        startedId = undefined;
        clearCanonicalActivitySubmission(canonical);
        canonical = undefined;
        return { kind: 'result' as const, result: stored };
      }

      providerPending = true;
      providerSettled = false;
      const result = await assessor.assess(canonical, input.signal, () => {
        providerPending = false;
        providerSettled = true;
        if (requestDone) release();
      });
      const completedAssessmentId = startedId;
      if (result.kind === 'accepted' && input.token) {
        let settled;
        try {
          settled = await settleAcceptedActivity({
            pool,
            token: input.token,
            principalId: input.principalId,
            profileId: input.profileId,
            assessmentId: completedAssessmentId,
            requestId: parsed.requestId,
            payloadDigest: canonical.payloadDigest,
            missionId: parsed.missionId,
            imageHashes: canonical.photos.map((photo) => photo.fingerprint),
            assessment: { ...result, assessmentId: completedAssessmentId },
            sourceContext: creditContext,
            signal: input.signal,
          });
        } catch (error) {
          if (
            input.signal?.aborted ||
            (error instanceof ApiError &&
              error.message === 'Assessment expired before reward settlement.')
          ) {
            const terminal = await completeAssessment({
              pool,
              id: completedAssessmentId,
              payloadDigest: canonical.payloadDigest,
              result: input.signal?.aborted
                ? stoppedResult(input.signal)
                : result,
            });
            startedId = undefined;
            return { kind: 'result' as const, result: terminal };
          }
          const databaseResult = databaseUnavailableResult(error);
          if (databaseResult) {
            // Reward settlement rolls back on a PostgreSQL statement/lock
            // timeout. Persist the terminal public result in a fresh short
            // transaction so GET recovery observes the same outcome.
            const terminal = await completeAssessment({
              pool,
              id: completedAssessmentId,
              payloadDigest: canonical.payloadDigest,
              result: databaseResult,
            });
            startedId = undefined;
            return { kind: 'result' as const, result: terminal };
          }
          throw error;
        }
        const stored = (await settled).outcome;
        startedId = undefined;
        return {
          kind: 'result' as const,
          result: {
            ...result,
            assessmentId: completedAssessmentId,
            reward: stored.reward,
            mission: stored.mission,
          },
        };
      }
      const stored = await completeAssessment({
        pool,
        id: completedAssessmentId,
        payloadDigest: canonical.payloadDigest,
        result,
      });
      startedId = undefined;
      return { kind: 'result' as const, result: stored };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw error;
    } finally {
      if (canonical && !providerPending)
        clearCanonicalActivitySubmission(canonical);
      requestDone = true;
      if (providerSettled) release();
    }
  }

  return {
    submit,
    providerEnabled: Boolean(provider),
    availabilityMode: provider ? creditContext : null,
    operationTimeoutMs,
  };
}
