import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { ApiError } from '../accounts/types.ts';
import { runPointsOperation } from '../points/index.ts';
import { lockJourneyForSettlement } from '../journeys/settlement.ts';
import { photoAward } from './policy.ts';

const claimSchema = z.strictObject({
  profileId: z.uuid(),
  requestId: z.uuid(),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  journeyId: z.uuid().nullable(),
  activity: z.enum(['bus-trip', 'other']),
  verdict: z.enum(['supported', 'not-supported', 'uncertain']),
  confidence: z.number().finite().min(0).max(1).nullable(),
});
const receiptSchema = z.strictObject({
  receiptId: z.uuid(),
  creditedPoints: z.literal(50),
  journeyId: z.uuid().nullable(),
});

export type PhotoCreditContext = 'synthetic_test' | 'live';

/** Test-only accounting seam. No HTTP adapter imports it. Live activation needs reviewed AI admission. */
export async function claimSyntheticPhoto(
  pool: Pool,
  token: string,
  value: unknown,
) {
  if (process.env.NODE_ENV !== 'test')
    throw new Error('Synthetic photo accounting is test-only.');
  return claimPhotoActivity(pool, token, value, 'synthetic_test');
}

/** Server-owned photo accounting seam. The caller must supply a reviewed assessment. */
export async function claimPhotoActivity(
  pool: Pool,
  token: string,
  value: unknown,
  context: PhotoCreditContext,
) {
  const input = claimSchema.parse(value);
  if (!photoAward(input))
    throw new ApiError(
      409,
      'Activity is not supported with sufficient confidence.',
    );
  if (input.journeyId && input.activity !== 'bus-trip')
    throw new ApiError(409, 'Only a bus photo can link to a journey.');
  return runPointsOperation({
    pool,
    token,
    access: 'owner',
    request: {
      profileId: input.profileId,
      requestId: input.requestId,
      kind: 'photo_activity',
    },
    intent: JSON.stringify([
      input.fingerprint,
      input.journeyId,
      input.activity,
    ]),
    outcomeSchema: receiptSchema,
    perform: async ({ client, actor, profile, operationId }) => {
      if (profile.kind !== 'real')
        throw new ApiError(409, 'Photo activity requires a real profile.');
      if (input.journeyId) {
        const journey = await lockJourneyForSettlement(
          client,
          actor.principalId,
          profile.id,
          input.journeyId,
        );
        if (context === 'synthetic_test' && journey.source.kind !== 'fixture')
          throw new ApiError(
            403,
            'Synthetic accounting requires a fixture journey.',
          );
        const prior = await client.query<{
          cumulative_automatic_credit: number;
        }>(
          'SELECT cumulative_automatic_credit FROM app.journey_award_state WHERE journey_id=$1',
          [input.journeyId],
        );
        if ((prior.rows[0]?.cumulative_automatic_credit ?? 0) > 0)
          throw new ApiError(409, 'Journey already rewarded.');
      }
      // Global pixel hash also serializes different accounts without disclosing the owner.
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`photo:${input.fingerprint}`],
      );
      const duplicate = await client.query(
        'SELECT 1 FROM app.photo_activity_claims WHERE photo_hash=$1 OR ($2::uuid IS NOT NULL AND journey_id=$2)',
        [input.fingerprint, input.journeyId],
      );
      if (duplicate.rowCount)
        throw new ApiError(409, 'Photo or journey already rewarded.');
      const receiptId = randomUUID();
      await client.query(
        `INSERT INTO app.photo_activity_claims(id,profile_id,photo_hash,journey_id,operation_id,activity,confidence,credited_points,credit_context) VALUES ($1,$2,$3,$4,$5,$6,$7,50,$8)`,
        [
          receiptId,
          profile.id,
          input.fingerprint,
          input.journeyId,
          operationId,
          input.activity,
          input.confidence,
          context,
        ],
      );
      return {
        delta: 50,
        reason:
          context === 'live'
            ? 'Verified photo activity.'
            : 'Synthetic test photo activity; no real-world assessment.',
        outcome: {
          receiptId,
          creditedPoints: 50 as const,
          journeyId: input.journeyId,
        },
      };
    },
  });
}

/** Called only while the owned profile and journey are locked by settlement. */
export async function readPhotoPreliminary(
  client: PoolClient,
  profileId: string,
  journeyId: string,
) {
  const rows = await client.query<{ credited_points: number }>(
    'SELECT credited_points FROM app.photo_activity_claims WHERE profile_id=$1 AND journey_id=$2',
    [profileId, journeyId],
  );
  return rows.rows[0]?.credited_points ?? 0;
}
