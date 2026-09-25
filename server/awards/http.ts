import type { Pool } from 'pg';
import { readJourneyAward, settleJourneyAward } from './store.ts';

/** API owner retains bearer extraction, origin/rate/size limits and error mapping.
 * No env, fixture, eligibility or credit overrides enter this adapter.
 */
export function createAwardsHandler({ pool }: { pool: Pool }) {
  return async ({
    method,
    path,
    token,
    readBody,
  }: {
    method: string | undefined;
    path: string;
    token: string;
    readBody: () => Promise<unknown>;
  }) => {
    const match = /^\/v1\/journeys\/([^/]+)\/(settlements|award)$/.exec(path);
    if (!match) return null;
    const [, journeyId, action] = match;
    if (method === 'POST' && action === 'settlements')
      return {
        status: 200,
        body: await settleJourneyAward({
          pool,
          token,
          journeyId,
          input: await readBody(),
        }),
      };
    if (method === 'GET' && action === 'award')
      return {
        status: 200,
        body: await readJourneyAward({ pool, token, journeyId }),
      };
    return null;
  };
}
