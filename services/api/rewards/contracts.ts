import { z } from 'zod';
import { ApiError } from '../accounts/types.ts';
import { MAX_POINTS } from '../points/contracts.ts';

export const uuid = z.uuid().transform((value) => value.toLowerCase());
const line = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\u0000-\u001f\u007f]+$/);
const fields = {
  title: line(100),
  description: line(500),
  pointsPrice: z.number().int().min(1).max(MAX_POINTS),
};
export const product = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('tree'), ...fields }),
  z.strictObject({
    kind: z.literal('content'),
    ...fields,
    text: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+$/),
  }),
  z.strictObject({
    kind: z.literal('discount'),
    ...fields,
    percentage: z.number().int().min(10).max(60),
  }),
]);
export const version = z.number().int().min(1).max(MAX_POINTS);
export const offer = z.strictObject({
  id: uuid,
  version,
  enabled: z.boolean(),
  product,
});
export const createOfferInput = z.strictObject({
  requestId: uuid,
  enabled: z.boolean(),
  product,
});
export const editOfferInput = createOfferInput.extend({
  offerId: uuid,
  expectedVersion: version,
});
export const purchaseInput = z.strictObject({
  profileId: uuid,
  requestId: uuid,
  offerId: uuid,
  offerVersion: version,
});
export const pageInput = z.strictObject({
  after: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const receiptFields = {
  id: uuid,
  profileId: uuid,
  offerId: uuid,
  offerVersion: version,
  title: fields.title,
  paidPoints: fields.pointsPrice,
  purchasedAt: z.iso.datetime(),
};
export const receipt = z.discriminatedUnion('kind', [
  z.strictObject({
    ...receiptFields,
    kind: z.literal('tree'),
    accountName: line(80),
    fulfilment: z.literal('demonstration'),
  }),
  z.strictObject({
    ...receiptFields,
    kind: z.literal('content'),
    fulfilment: z.literal('unlocked'),
  }),
  z.strictObject({
    ...receiptFields,
    kind: z.literal('discount'),
    percentage: z.number().int().min(10).max(60),
    fulfilment: z.literal('demonstration'),
  }),
]);
export type Offer = z.infer<typeof offer>;
export type Receipt = z.infer<typeof receipt>;
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, 'Invalid rewards request.');
  return parsed.data;
}

// The catalogue exposes descriptions and prices, never unpurchased content.
export function publicOffer(value: Offer) {
  const { product, ...metadata } = value;
  if (product.kind === 'content') {
    const { text: _text, ...summary } = product;
    return { ...metadata, product: summary };
  }
  return { ...metadata, product };
}
