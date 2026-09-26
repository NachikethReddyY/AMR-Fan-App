import type { Request } from '../account/api';
import type { Context } from '../account/resource';
import type { TravelQuery } from '../routes/api';
import {
  awardSchema,
  journeySchema,
  listSchema,
  planSchema,
  type FinishReason,
  type Sample,
} from './contracts';

export function createJourneyApi(request: Request) {
  const path = (id: string) => `/v1/journeys/${encodeURIComponent(id)}`;
  const owned = (raw: unknown, ctx: Context, id?: string) => {
    const value = journeySchema.parse(raw);
    if (value.profileId !== ctx.profileId || (id && value.id !== id))
      throw new Error('Journey response does not match this profile.');
    return value;
  };
  return {
    prepare: async (ctx: Context, requestId: string, query: TravelQuery) => {
      const plan = planSchema.parse(
        await request('/v1/journeys/prepare', ctx.token, 'POST', {
          profileId: ctx.profileId,
          requestId,
          query: { ...query, modes: ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'] },
        }),
      );
      if (plan.kind === 'prepared') {
        const ids = new Set<string>();
        for (const c of plan.candidates) {
          if (ids.has(c.routeId)) throw new Error('Duplicate route candidate.');
          ids.add(c.routeId);
          if (c.kind === 'prepared' && c.journey.profileId !== ctx.profileId)
            throw new Error('Foreign journey response.');
        }
        if (
          plan.display &&
          plan.candidates.some(
            (c) => !plan.display?.routes.some((r) => r.routeId === c.routeId),
          )
        )
          throw new Error('Candidate is absent from comparison.');
      }
      return plan;
    },
    start: async (
      ctx: Context,
      id: string,
      requestId: string,
      captureSessionId: string,
    ) =>
      owned(
        await request(`${path(id)}/start`, ctx.token, 'POST', {
          requestId,
          captureSessionId,
        }),
        ctx,
        id,
      ),
    evidence: async (
      ctx: Context,
      id: string,
      requestId: string,
      captureSessionId: string,
      samples: Sample[],
    ) =>
      owned(
        await request(`${path(id)}/evidence`, ctx.token, 'POST', {
          requestId,
          captureSessionId,
          samples,
        }),
        ctx,
        id,
      ),
    finish: async (
      ctx: Context,
      id: string,
      requestId: string,
      captureSessionId: string,
      endedAtMs: number,
      reason: FinishReason,
    ) =>
      owned(
        await request(`${path(id)}/finish`, ctx.token, 'POST', {
          requestId,
          captureSessionId,
          endedAtMs,
          reason,
        }),
        ctx,
        id,
      ),
    read: async (ctx: Context, id: string) =>
      owned(await request(path(id), ctx.token), ctx, id),
    list: async (ctx: Context) => {
      const list = listSchema.parse(
        await request(
          `/v1/profiles/${encodeURIComponent(ctx.profileId)}/journeys?state=active&limit=20`,
          ctx.token,
        ),
      );
      if (list.profileId !== ctx.profileId)
        throw new Error('Foreign journey list.');
      return list;
    },
    settle: async (
      ctx: Context,
      id: string,
      requestId: string,
      version: string,
      revision: number,
    ) => {
      const award = awardSchema.parse(
        await request(`${path(id)}/settlements`, ctx.token, 'POST', {
          profileId: ctx.profileId,
          requestId,
          assessmentVersion: version,
          assessmentRevision: revision,
        }),
      );
      if (
        award.receipt.profileId !== ctx.profileId ||
        award.receipt.journeyId !== id
      )
        throw new Error('Foreign award response.');
      return award;
    },
  };
}
export type JourneyApi = ReturnType<typeof createJourneyApi>;
