import {
  parseComparison,
  estimated,
  estimatedCo2,
  estimateSchema,
  type Comparison,
  type TravelQuery,
} from '@amr/travel-domain/comparison';
import type { Request } from '../account/api.ts';
import type { Context } from '../account/resource.ts';

export { parseComparison, estimated, estimatedCo2, estimateSchema };
export type { Comparison, TravelQuery };

export function createTravelApi(request: Request) {
  return async (ctx: Context, query: TravelQuery) =>
    parseComparison(
      await request('/v1/routes/query', ctx.token, 'POST', {
        ...query,
        modes: ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'],
      }),
    );
}
