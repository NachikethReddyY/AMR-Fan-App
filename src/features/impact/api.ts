import type { Request } from '../account/api.ts';
import type { Context } from '../account/resource.ts';
import { parseOfficial } from './contracts.ts';
export function createOfficialApi(request: Request) {
  return async (ctx: Context) => ({
    items: parseOfficial(await request('/v1/impact/official', ctx.token)),
    nextCursor: null,
  });
}
