import { z } from 'zod';
import { ApiError } from '../accounts/types.ts';

export const MAX_POINTS = 2_147_483_647;
const uuid = z.uuid().transform((value) => value.toLowerCase());
export const points = z.number().int().min(0).max(MAX_POINTS);
export const pointsDelta = z.number().int().min(-MAX_POINTS).max(MAX_POINTS);
export const reason = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^[^\u0000-\u001f\u007f]+$/);
export const adjustmentInput = z.strictObject({
  targetProfileId: uuid,
  requestId: uuid,
  delta: pointsDelta.refine((value) => value !== 0),
  reason,
});
export const operationRequest = z.strictObject({
  profileId: uuid,
  requestId: uuid,
  kind: z.string().min(1).max(80),
});
export const historyEntry = z.strictObject({
  id: uuid,
  sequence: z.string().regex(/^[1-9]\d*$/),
  profileId: uuid,
  actorId: uuid,
  kind: z.string(),
  delta: pointsDelta,
  balanceAfter: points,
  reason,
  recordedAt: z.iso.datetime(),
});
export type HistoryEntry = z.infer<typeof historyEntry>;
export const historyQuery = z.strictObject({
  before: z
    .string()
    .regex(/^[1-9]\d{0,18}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, 'Invalid points request.');
  return result.data;
}
export const profileIdInput = uuid;
