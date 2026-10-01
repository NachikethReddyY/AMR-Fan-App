import type { IncomingMessage } from 'node:http';
import type { Pool } from 'pg';
import { authenticateSession } from '../auth/session.ts';
import { readOwnedProfile } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';
import {
  MAX_SUBMISSION_BODY_BYTES,
  parseActivitySubmission,
} from './submission-contract.ts';
import type { ActivitySubmissionService } from './submission-service.ts';
import { readAssessmentByRequest } from './assessment-store.ts';

class SubmissionAbortError extends Error {
  readonly reason: 'timeout' | 'request_cancelled';
  constructor(reason: 'timeout' | 'request_cancelled') {
    super('Activity submission aborted.');
    this.reason = reason;
  }
}

function abortError(signal: AbortSignal): SubmissionAbortError {
  return new SubmissionAbortError(
    signal.reason === 'timeout' ? 'timeout' : 'request_cancelled',
  );
}

async function readBody(req: IncomingMessage, signal?: AbortSignal) {
  if (req.headers['content-type'] !== 'application/json')
    throw new ApiError(415, 'Use application/json.');
  const contentLength = Number(req.headers['content-length']);
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_SUBMISSION_BODY_BYTES
  )
    throw new ApiError(413, 'Activity submission is too large.');
  const chunks: Buffer[] = [];
  let bytes = 0;
  let stopped = false;
  const iterator = req[Symbol.asyncIterator]();
  const collect = (async () => {
    try {
      while (!stopped) {
        const next = await iterator.next();
        if (next.done) break;
        const chunk = next.value;
        if (stopped || signal?.aborted) throw abortError(signal!);
        const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += value.byteLength;
        if (bytes > MAX_SUBMISSION_BODY_BYTES)
          throw new ApiError(413, 'Activity submission is too large.');
        chunks.push(value);
      }
    } catch (error) {
      for (const chunk of chunks) chunk.fill(0);
      chunks.length = 0;
      if (signal?.aborted) throw abortError(signal);
      throw error;
    }
  })();
  let abort: (() => void) | undefined;
  const cancelled = signal
    ? new Promise<never>((_, reject) => {
        abort = () => {
          stopped = true;
          req.pause();
          const returned = iterator.return?.();
          void returned?.catch(() => undefined);
          for (const chunk of chunks) chunk.fill(0);
          chunks.length = 0;
          reject(abortError(signal));
        };
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
      })
    : undefined;
  try {
    await (cancelled ? Promise.race([collect, cancelled]) : collect);
  } finally {
    if (abort) signal?.removeEventListener('abort', abort);
    // Prevent a rejected background collector from becoming an unhandled error
    // after an abort wins the race.
    void collect.catch(() => undefined);
  }
  const encoded = Buffer.concat(chunks);
  try {
    if (signal?.aborted) throw abortError(signal);
    const value: unknown = JSON.parse(encoded.toString('utf8'));
    if (signal?.aborted) throw abortError(signal);
    return parseActivitySubmission(value);
  } catch (error) {
    if (error instanceof SubmissionAbortError) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Invalid activity submission.');
  } finally {
    encoded.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
}

/** Authenticates and scopes the versioned evidence route before reading media. */
export async function handleActivitySubmission({
  req,
  path,
  pool,
  token,
  service,
}: {
  req: IncomingMessage;
  path: string;
  pool: Pool;
  token: string;
  service: ActivitySubmissionService;
}) {
  const match =
    /^\/v1\/profiles\/([^/]+)\/activity-submissions(?:\/([^/]+))?$/.exec(path);
  if (!match) return null;
  const actor = await authenticateSession(pool, token);
  const profile = await readOwnedProfile(pool, actor.principalId, match[1]);
  if (profile.kind !== 'real')
    throw new ApiError(409, 'Photo activity requires a real profile.');
  if (match[2] === 'availability') {
    if (req.method !== 'GET') throw new ApiError(405, 'Method not allowed.');
    return {
      status: 200,
      body: service.providerEnabled
        ? {
            kind: 'available' as const,
            mode: service.availabilityMode ?? 'production',
            limits: { photos: 5, description: 1600 },
          }
        : { kind: 'unavailable' as const, reason: 'disabled' as const },
    };
  }
  if (match[2]) {
    if (req.method !== 'GET') throw new ApiError(405, 'Method not allowed.');
    const recovered = await readAssessmentByRequest({
      pool,
      principalId: actor.principalId,
      profileId: profile.id,
      requestId: match[2],
    });
    // The store uses a transient `busy` sentinel while a request is still
    // processing. Keep that internal detail out of the public assessment
    // contract and expose the declared unavailable result instead.
    return {
      status: 200,
      body:
        recovered.kind === 'busy'
          ? { kind: 'unavailable' as const, reason: 'busy' as const }
          : recovered,
    };
  }
  if (req.method !== 'POST') throw new ApiError(405, 'Method not allowed.');
  const controller = new AbortController();
  const aborted = () => controller.abort('request_cancelled');
  req.once('aborted', aborted);
  if (req.aborted) aborted();
  const deadline = setTimeout(
    () => controller.abort('timeout'),
    service.operationTimeoutMs,
  );
  let input;
  let result;
  try {
    // A disabled provider must not cause body/media work or consume user data.
    if (!service.providerEnabled)
      return { status: 503, body: { kind: 'unavailable', reason: 'disabled' } };
    try {
      input = await readBody(req, controller.signal);
    } catch (error) {
      if (error instanceof SubmissionAbortError)
        return {
          status: 200,
          body:
            error.reason === 'timeout'
              ? { kind: 'unavailable', reason: 'timeout' }
              : { kind: 'cancelled', reason: 'request_cancelled' },
        };
      throw error;
    }
    if (controller.signal.aborted) {
      const timedOut = controller.signal.reason === 'timeout';
      return {
        status: 200,
        body: timedOut
          ? { kind: 'unavailable', reason: 'timeout' }
          : { kind: 'cancelled', reason: 'request_cancelled' },
      };
    }
    result = await service.submit({
      principalId: actor.principalId,
      profileId: profile.id,
      token,
      body: input,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(deadline);
    req.removeListener('aborted', aborted);
  }
  const body = result.kind === 'replay' ? result : result.result;
  return {
    status:
      body.kind === 'unavailable' && 'reason' in body && body.reason === 'busy'
        ? 503
        : 200,
    body,
  };
}
