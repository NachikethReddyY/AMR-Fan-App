import type { Pool } from 'pg';
import {
  createOffer,
  editOffer,
  listAdminOffers,
  listOffers,
  purchaseReward,
  readContent,
  readOffer,
  readReceipts,
} from './index.ts';

/** Register after the API's origin/rate/bearer guards; body is its bounded JSON reader. */
export async function dispatchRewards({
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
  query: Record<string, string>;
  body: () => Promise<Record<string, unknown>>;
}): Promise<{ status: number; value: unknown } | null> {
  if (path === '/v1/admin/rewards/offers') {
    if (method === 'GET')
      return { status: 200, value: await listAdminOffers(pool, token, query) };
    if (method === 'POST')
      return {
        status: 201,
        value: await createOffer(pool, token, await body()),
      };
    if (method === 'PATCH')
      return { status: 200, value: await editOffer(pool, token, await body()) };
  }
  if (path === '/v1/rewards/purchases' && method === 'POST')
    return {
      status: 201,
      value: await purchaseReward(pool, token, await body()),
    };
  const match =
    /^\/v1\/profiles\/([^/]+)\/rewards\/(offers|receipts|content)(?:\/([^/]+))?$/.exec(
      path,
    );
  if (!match || method !== 'GET') return null;
  const [, profileId, resource, offerId] = match;
  if (resource === 'offers')
    return {
      status: 200,
      value: offerId
        ? await readOffer(pool, token, profileId, offerId)
        : await listOffers(pool, token, profileId, query),
    };
  if (resource === 'receipts' && !offerId)
    return {
      status: 200,
      value: await readReceipts(pool, token, profileId, query),
    };
  if (resource === 'content' && offerId)
    return {
      status: 200,
      value: await readContent(pool, token, profileId, offerId),
    };
  return null;
}
