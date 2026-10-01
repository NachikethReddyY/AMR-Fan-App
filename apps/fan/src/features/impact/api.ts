import type { Request } from '../account/api.ts';
import type { Context } from '../account/resource.ts';
import { parseOfficial, parseContributions } from './contracts.ts';
export function createOfficialApi(request: Request) {
  return async (ctx: Context) => ({
    items: parseOfficial(await request('/v1/impact/official', ctx.token)),
    nextCursor: null,
  });
}

export function createContributionApi(request: Request) {
  return async (ctx: Context) => ({
    items: [
      {
        ...parseContributions(
          await request(`/v1/profiles/${ctx.profileId}/impact`, ctx.token),
        ),
        id: ctx.profileId,
      },
    ],
    nextCursor: null,
  });
}
