import type { Pool } from 'pg';
import { z } from 'zod';
import { ApiError } from '../accounts/types.ts';
import { runPointsOperation } from './index.ts';

const inputSchema = z.strictObject({
  profileId: z.uuid(),
  requestId: z.uuid(),
  routeId: z.string().trim().min(1).max(200),
  savedKg: z.number().finite().min(0).max(40),
  distanceMeters: z
    .number()
    .finite()
    .nonnegative()
    .max(1000000)
    .nullable()
    .optional(),
});
const outcomeSchema = z.strictObject({
  points: z.number().int().nonnegative(),
  balanceAfter: z.number().int().nonnegative(),
  routeId: z.string(),
  savedKg: z.number().finite().nonnegative().max(40).optional(),
  distanceMeters: z.number().finite().nonnegative().nullable().optional(),
});

export function routeRewardPoints(savedKg: number) {
  return Math.min(2000, Math.round(Math.max(0, savedKg) * 50));
}

export async function awardRouteReward(
  pool: Pool,
  token: string,
  raw: unknown,
) {
  const input = inputSchema.parse(raw);
  const points = routeRewardPoints(input.savedKg);
  const result = await runPointsOperation({
    pool,
    token,
    access: 'owner',
    request: {
      profileId: input.profileId,
      requestId: input.requestId,
      kind: 'route_completion',
    },
    intent: JSON.stringify([input.routeId, 'provisional-route-v1']),
    outcomeSchema,
    perform: async ({ profile }) => ({
      delta: points,
      reason: `Provisional route completion reward for ${input.routeId}.`,
      outcome: {
        points,
        balanceAfter: profile.balance + points,
        routeId: input.routeId,
        savedKg: input.savedKg,
        distanceMeters: input.distanceMeters ?? null,
      },
    }),
  });
  if (!result.entry) throw new ApiError(500, 'Route reward was not recorded.');
  return {
    points: result.entry.delta,
    balanceAfter: result.entry.balanceAfter,
    routeId: input.routeId,
    savedKg: input.savedKg,
    distanceMeters: input.distanceMeters ?? null,
    receiptId: result.entry.id,
  };
}
