import type { Pool } from 'pg';
import { ApiError } from '../accounts/types.ts';
import {
  createSubmission,
  listOwnSubmissions,
  listAdminSubmissions,
  moderateSubmission,
} from './index.ts';

/** The shared API owns body byte limits, origin/rate guards and error responses. */
export async function handleSubmissionRequest({
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
  const owner = /^\/v1\/profiles\/([^/]+)\/submissions$/.exec(path);
  if (owner) {
    if (method === 'GET')
      return {
        status: 200,
        value: await listOwnSubmissions(pool, token, owner[1], query),
      };
    if (method === 'POST')
      return {
        status: 201,
        value: await createSubmission(pool, token, owner[1], await body()),
      };
    throw new ApiError(405, 'Method not allowed.');
  }
  if (path === '/v1/admin/submissions') {
    if (method !== 'GET') throw new ApiError(405, 'Method not allowed.');
    return {
      status: 200,
      value: await listAdminSubmissions(pool, token, query),
    };
  }
  const decision = /^\/v1\/admin\/submissions\/([^/]+)\/decision$/.exec(path);
  if (decision) {
    if (method !== 'POST') throw new ApiError(405, 'Method not allowed.');
    return {
      status: 200,
      value: await moderateSubmission(pool, token, decision[1], await body()),
    };
  }
  return null;
}
