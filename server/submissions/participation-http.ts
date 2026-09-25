import type { Pool } from 'pg';
import { ApiError } from '../accounts/types.ts';
import {
  contributeToSubmission,
  readSharedSubmissions,
  readOwnSubmissionParticipation,
  createInteractionSession,
  closeInteractionSession,
  listInteractionSessions,
  resolveSubmissionSelection,
} from './participation.ts';

// The registered API owns bearer extraction, bounded JSON, origin/rate guards and errors.
export async function handleParticipationRequest({
  pool,
  token,
  method,
  path,
  query,
  body,
}: {
  pool: Pool;
  token: string;
  method: string | undefined;
  path: string;
  query: unknown;
  body: () => Promise<unknown>;
}): Promise<{ status: number; value: unknown } | null> {
  const request = { pool, token };
  if (path === '/v1/submissions/ranking') {
    if (method !== 'GET') throw new ApiError(405, 'Method not allowed.');
    return {
      status: 200,
      value: await readSharedSubmissions({ ...request, query }),
    };
  }
  const owner = /^\/v1\/profiles\/([^/]+)\/submission-participation$/.exec(
    path,
  );
  if (owner) {
    if (method !== 'GET') throw new ApiError(405, 'Method not allowed.');
    return {
      status: 200,
      value: await readOwnSubmissionParticipation({
        ...request,
        profileId: owner[1],
        query,
      }),
    };
  }
  const contribution =
    /^\/v1\/profiles\/([^/]+)\/submissions\/([^/]+)\/contributions$/.exec(path);
  if (contribution) {
    if (method !== 'POST') throw new ApiError(405, 'Method not allowed.');
    return {
      status: 201,
      value: await contributeToSubmission({
        ...request,
        profileId: contribution[1],
        submissionId: contribution[2],
        value: await body(),
      }),
    };
  }
  if (path === '/v1/admin/submission-sessions') {
    if (method === 'GET')
      return {
        status: 200,
        value: await listInteractionSessions({ ...request, query }),
      };
    if (method === 'POST')
      return {
        status: 201,
        value: await createInteractionSession({
          ...request,
          value: await body(),
        }),
      };
    throw new ApiError(405, 'Method not allowed.');
  }
  const close = /^\/v1\/admin\/submission-sessions\/([^/]+)\/close$/.exec(path);
  if (close) {
    if (method !== 'POST') throw new ApiError(405, 'Method not allowed.');
    return {
      status: 200,
      value: await closeInteractionSession({
        ...request,
        sessionId: close[1],
        value: await body(),
      }),
    };
  }
  const resolve = /^\/v1\/admin\/submission-selections\/([^/]+)\/resolve$/.exec(
    path,
  );
  if (resolve) {
    if (method !== 'POST') throw new ApiError(405, 'Method not allowed.');
    return {
      status: 200,
      value: await resolveSubmissionSelection({
        ...request,
        selectionId: resolve[1],
        value: await body(),
      }),
    };
  }
  return null;
}
