import { AccountError } from '../account/api';
import {
  activitySubmissionAvailabilitySchema,
  activitySubmissionAssessmentResultSchema,
  activitySubmissionRecoverySchema,
  activitySubmissionRequestSchema,
  type ActivitySubmissionRequest,
  type ActivitySubmissionAvailability,
  type ActivitySubmissionRecovery,
  type ActivitySubmissionAssessmentResult,
} from '../../../server/activity/submission-result-contract';

export type ActivityCapability = ActivitySubmissionAvailability;
export type ActivityAssessmentResult = ActivitySubmissionAssessmentResult;
export type ActivityRecovery = ActivitySubmissionRecovery;
export type ActivitySubmissionInput = ActivitySubmissionRequest;

function createBase(value: string, development: boolean) {
  if (!value) return null;
  const base = new URL(value);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/' ||
    (base.protocol !== 'https:' &&
      !(
        development &&
        base.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '10.0.2.2'].includes(base.hostname)
      ))
  )
    throw new Error('Use a secure API URL.');
  return base;
}

export function createActivityApi(baseUrl: string, development: boolean) {
  const base = createBase(baseUrl, development);
  async function request(
    path: string,
    token: string,
    signal: AbortSignal,
    method = 'GET',
    body?: unknown,
  ) {
    if (!base) throw new AccountError(503, 'Activity checks are unavailable.');
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
          : response.status === 409
            ? 'This request conflicts with a saved result.'
            : 'Activity checks are unavailable. Try again later.',
      );
    return response.json();
  }
  const capability = async (
    token: string,
    profileId: string,
    signal: AbortSignal,
  ) =>
    activitySubmissionAvailabilitySchema.parse(
      await request(
        `/v1/profiles/${encodeURIComponent(profileId)}/activity-submissions/availability`,
        token,
        signal,
      ),
    );
  return Object.assign(capability, {
    capability,
    submit: async (
      token: string,
      profileId: string,
      input: ActivitySubmissionInput,
      signal: AbortSignal,
    ): Promise<ActivityAssessmentResult> =>
      activitySubmissionAssessmentResultSchema.parse(
        await request(
          `/v1/profiles/${encodeURIComponent(profileId)}/activity-submissions`,
          token,
          signal,
          'POST',
          activitySubmissionRequestSchema.parse(input),
        ),
      ),
    recover: async (
      token: string,
      profileId: string,
      requestId: string,
      signal: AbortSignal,
    ): Promise<ActivityRecovery> =>
      activitySubmissionRecoverySchema.parse(
        await request(
          `/v1/profiles/${encodeURIComponent(profileId)}/activity-submissions/${encodeURIComponent(requestId)}`,
          token,
          signal,
        ),
      ),
  });
}
