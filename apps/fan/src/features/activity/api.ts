import { z } from 'zod';
import { AccountError } from '../account/api';
import type { ActivityResult } from './lifecycle';

const resultSchema = z.strictObject({
  kind: z.literal('unavailable'),
  creditedPoints: z.literal(0),
});

/** Capability check first: no photo or description leaves the phone while AI is disabled. */
export function createActivityApi(baseUrl: string, development: boolean) {
  const base = baseUrl ? new URL(baseUrl) : null;
  if (
    base &&
    (base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== '/' ||
      (base.protocol !== 'https:' &&
        !(
          development &&
          base.protocol === 'http:' &&
          ['127.0.0.1', 'localhost', '10.0.2.2'].includes(base.hostname)
        )))
  )
    throw new Error('Use a secure API URL.');
  return async (
    token: string,
    profileId: string,
    signal: AbortSignal,
  ): Promise<ActivityResult> => {
    if (!base) return { kind: 'unavailable', creditedPoints: 0 };
    const response = await fetch(
      new URL(
        `/v1/profiles/${encodeURIComponent(profileId)}/activity/availability`,
        base,
      ).href,
      { headers: { Authorization: `Bearer ${token}` }, signal },
    );
    if (!response.ok)
      throw new AccountError(
        response.status,
        response.status === 401
          ? 'Your session expired. Sign in again.'
          : 'Activity checks are unavailable. Try again later.',
      );
    return resultSchema.parse(await response.json());
  };
}
