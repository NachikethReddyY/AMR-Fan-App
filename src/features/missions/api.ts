import { AccountError } from '../account/api';
import {
  missionEnrollmentResponse,
  missionsResponse,
  type MissionListEntry,
} from '../../../server/activity/reward-contract';

export type Mission = MissionListEntry;
export type MissionsResponse = ReturnType<typeof missionsResponse.parse>;

export function createMissionsApi(baseUrlValue: string, development: boolean) {
  const base = baseUrlValue ? new URL(baseUrlValue) : null;
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
  async function request(
    path: string,
    token: string,
    signal: AbortSignal,
    method = 'GET',
    body?: unknown,
  ) {
    if (!base) throw new AccountError(503, 'Missions are unavailable.');
    const response = await fetch(new URL(path, base).href, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    if (!response.ok)
      throw new AccountError(
        response.status,
        response.status === 401
          ? 'Your session expired. Sign in again.'
          : 'Missions are unavailable. Try again.',
      );
    return response.json();
  }
  return {
    list: async (token: string, profileId: string, signal: AbortSignal) =>
      missionsResponse.parse(
        await request(
          `/v1/missions?profileId=${encodeURIComponent(profileId)}`,
          token,
          signal,
        ),
      ),
    enroll: async (
      token: string,
      missionId: string,
      profileId: string,
      signal: AbortSignal,
    ) =>
      missionEnrollmentResponse.parse(
        await request(
          `/v1/missions/${encodeURIComponent(missionId)}/enroll`,
          token,
          signal,
          'POST',
          { profileId },
        ),
      ),
  };
}
