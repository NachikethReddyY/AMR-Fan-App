import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { ApiError } from '../accounts/types.ts';
import { authenticateSession } from '../auth/session.ts';
import { transaction } from '../database/index.ts';
import { id } from '../journeys/contracts.ts';
import { lockJourneyForSettlement } from '../journeys/settlement.ts';
import { parseInput, points } from '../points/contracts.ts';
import { receiptSchema } from './contracts.ts';
import { executeSettlement, type SettlementArgs } from './operation.ts';

export function settleJourneyAward(args: SettlementArgs) {
  return executeSettlement(args, 'production_unavailable');
}

export async function readJourneyAward({
  pool,
  token,
  journeyId,
}: {
  pool: Pool;
  token: string;
  journeyId: string;
}) {
  const selectedId = parseInput(id, journeyId);
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    const hash = createHash('sha256').update(token).digest('hex');
    await client.query('SELECT id FROM app.principals WHERE id=$1 FOR SHARE', [
      actor.principalId,
    ]);
    const session = await client.query(
      'SELECT token_hash FROM app.sessions WHERE token_hash=$1 AND principal_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE',
      [hash, actor.principalId],
    );
    const fresh = await client.query(
      'SELECT 1 FROM app.sessions WHERE token_hash=$1 AND expires_at>clock_timestamp()',
      [hash],
    );
    if (!session.rowCount || !fresh.rowCount)
      throw new ApiError(401, 'Sign in again.');
    const target = await client.query<{ profile_id: string }>(
      'SELECT profile_id FROM app.journeys WHERE id=$1',
      [selectedId],
    );
    if (!target.rows[0]) throw new ApiError(404, 'Journey not found.');
    const journey = await lockJourneyForSettlement(
      client,
      actor.principalId,
      target.rows[0].profile_id,
      selectedId,
    );
    const state = await client.query<{
      cumulative_automatic_credit: number;
      receipt: unknown;
    }>(
      `SELECT s.cumulative_automatic_credit,a.receipt FROM app.journey_award_state s
       JOIN app.journey_award_assessments a ON a.id=s.latest_receipt_id WHERE s.journey_id=$1`,
      [selectedId],
    );
    return {
      journeyId: selectedId,
      profileId: journey.profileId,
      currentAssessmentIdentity: journey.assessmentIdentity,
      cumulativeAutomaticCredit: points.parse(
        state.rows[0]?.cumulative_automatic_credit ?? 0,
      ),
      latestReceipt: state.rows[0]
        ? receiptSchema.parse(state.rows[0].receipt)
        : null,
    };
  });
}
