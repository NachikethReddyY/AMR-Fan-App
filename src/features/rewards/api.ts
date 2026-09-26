import { z } from 'zod';
import type { Request } from '../account/api.ts';
import type { Context } from '../account/resource.ts';
import {
  offerSchema,
  ownedReceipt,
  receiptSchema,
  type Purchase,
} from './contracts.ts';
export function createRewardsApi(request: Request) {
  const path = (ctx: Context) =>
    `/v1/profiles/${encodeURIComponent(ctx.profileId)}/rewards`;
  const query = (after?: string) => {
    const q = new URLSearchParams({ limit: '25' });
    if (after) q.set('after', after);
    return q;
  };
  return {
    offers: async (ctx: Context, after?: string) => {
      const p = z
        .object({
          offers: z.array(offerSchema).max(25),
          nextCursor: z.uuid().nullable(),
        })
        .parse(await request(`${path(ctx)}/offers?${query(after)}`, ctx.token));
      return { items: p.offers, nextCursor: p.nextCursor };
    },
    offer: async (ctx: Context, id: string) =>
      offerSchema.parse(
        await request(
          `${path(ctx)}/offers/${encodeURIComponent(id)}`,
          ctx.token,
        ),
      ),
    receipts: async (ctx: Context, after?: string) => {
      const p = z
        .object({
          receipts: z.array(receiptSchema).max(25),
          nextCursor: z.uuid().nullable(),
        })
        .parse(
          await request(`${path(ctx)}/receipts?${query(after)}`, ctx.token),
        );
      return {
        items: p.receipts.map((r) => ownedReceipt(r, ctx.profileId)),
        nextCursor: p.nextCursor,
      };
    },
    purchase: async (ctx: Context, input: Purchase) => {
      const raw = z
        .object({ outcome: z.unknown() })
        .parse(
          await request('/v1/rewards/purchases', ctx.token, 'POST', {
            ...input,
            profileId: ctx.profileId,
          }),
        );
      return ownedReceipt(raw.outcome, ctx.profileId);
    },
    content: async (ctx: Context, id: string) => {
      const raw = z
        .object({ receipt: receiptSchema, text: z.string().max(2000) })
        .parse(
          await request(
            `${path(ctx)}/content/${encodeURIComponent(id)}`,
            ctx.token,
          ),
        );
      const receipt = ownedReceipt(raw.receipt, ctx.profileId);
      if (receipt.kind !== 'content' || receipt.offerId !== id)
        throw new Error('Invalid retained content.');
      return { ...raw, receipt };
    },
  };
}
