import { z } from 'zod';
const uuid = z.uuid();
const price = z.number().int().min(1).max(2147483647);
const fields = {
  title: z.string().min(1).max(100),
  description: z.string().max(500),
  pointsPrice: price,
};
export const offerSchema = z.object({
  id: uuid,
  version: price,
  enabled: z.boolean(),
  product: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('tree'), ...fields }),
    z.object({ kind: z.literal('content'), ...fields }),
    z.object({
      kind: z.literal('discount'),
      ...fields,
      percentage: z.number().int().min(10).max(60),
    }),
  ]),
});
const receiptFields = {
  id: uuid,
  profileId: uuid,
  offerId: uuid,
  offerVersion: price,
  title: fields.title,
  paidPoints: price,
  purchasedAt: z.iso.datetime(),
};
export const receiptSchema = z.discriminatedUnion('kind', [
  z.object({
    ...receiptFields,
    kind: z.literal('tree'),
    accountName: z.string().max(80),
    fulfilment: z.literal('demonstration'),
  }),
  z.object({
    ...receiptFields,
    kind: z.literal('content'),
    fulfilment: z.literal('unlocked'),
  }),
  z.object({
    ...receiptFields,
    kind: z.literal('discount'),
    percentage: z.number().int().min(10).max(60),
    fulfilment: z.literal('demonstration'),
  }),
]);
export const purchaseSchema = z.strictObject({
  requestId: uuid,
  offerId: uuid,
  offerVersion: price,
});
export type Offer = z.infer<typeof offerSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type Purchase = z.infer<typeof purchaseSchema>;
export function ownedReceipt(raw: unknown, profileId: string) {
  const receipt = receiptSchema.parse(raw);
  if (receipt.profileId !== profileId)
    throw new Error('Invalid receipt owner.');
  return receipt;
}
