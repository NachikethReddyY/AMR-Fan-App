import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ApiError } from '../accounts/types.ts';
import { id } from '../journeys/contracts.ts';
import { lockJourneyForSettlement } from '../journeys/settlement.ts';
import { parseInput, points } from '../points/contracts.ts';
import { runPointsOperation } from '../points/index.ts';
import {
  outcomeSchema,
  receiptSchema,
  settlementInput,
  type AwardOutcome,
} from './contracts.ts';
import { calculateJourneyAward } from './policy.ts';
import { readPhotoPreliminary } from '../activity/claims.ts';
import { remainingJourneyAward } from '../activity/policy.ts';

export type SettlementArgs = {
  pool: Pool;
  token: string;
  journeyId: string;
  input: unknown;
};
type CreditContext = AwardOutcome['creditContext'];

// Internal composition shared with testing/service.ts. No HTTP/client option
// reaches creditContext; even direct server misuse cannot enable it outside test.
export function executeSettlement(
  args: SettlementArgs,
  creditContext: CreditContext,
) {
  if (creditContext === 'synthetic_test' && process.env.NODE_ENV !== 'test')
    throw new Error('Synthetic accounting requires NODE_ENV=test.');
  const journeyId = parseInput(id, args.journeyId);
  const input = parseInput(settlementInput, args.input);
  return runPointsOperation({
    pool: args.pool,
    token: args.token,
    access: 'owner',
    request: {
      profileId: input.profileId,
      requestId: input.requestId,
      kind: 'journey_settlement',
    },
    intent: JSON.stringify([
      journeyId,
      input.assessmentVersion,
      input.assessmentRevision,
      creditContext,
    ]),
    outcomeSchema,
    perform: async ({ client, profile, actor, operationId }) => {
      if (profile.kind !== 'real')
        throw new ApiError(
          409,
          'Real journey settlement requires a real profile.',
        );
      const journey = await lockJourneyForSettlement(
        client,
        actor.principalId,
        profile.id,
        journeyId,
      );
      if (journey.state !== 'finished')
        throw new ApiError(409, 'Finish the journey before settlement.');
      if (
        creditContext === 'synthetic_test' &&
        (process.env.NODE_ENV !== 'test' || journey.source.kind !== 'fixture')
      )
        throw new ApiError(
          403,
          'Synthetic accounting requires server-owned fixture provenance.',
        );
      // Future demo/reset owner checks cancellation/generation here, after replay
      // and the owned-profile lock, before any fresh receipt or credit. Real only.
      if (
        journey.assessmentIdentity.version !== input.assessmentVersion ||
        journey.assessmentIdentity.revision !== input.assessmentRevision
      )
        throw new ApiError(409, 'Journey assessment changed. Read it again.');
      const result = calculateJourneyAward(journey);
      const receipt = receiptSchema.parse({
        journeyId,
        profileId: profile.id,
        assessmentIdentity: journey.assessmentIdentity,
        source: journey.source,
        routeEvidence: journey.routeEvidence,
        basis: journey.basis,
        earningPolicy: journey.earningPolicy,
        selectedLegs: journey.selectedLegs,
        assessedLegs: journey.assessedLegs,
        assessment: journey.assessment,
        startedAtMs: journey.startedAtMs,
        finishedAtMs: journey.finishedAtMs,
        finishReason: journey.finishReason,
        mode: journey.mode,
        policy: journey.policy,
        result,
      });
      const prior = await client.query<{ id: string; receipt: unknown }>(
        'SELECT id, receipt FROM app.journey_award_assessments WHERE journey_id=$1 AND assessment_version=$2 AND assessment_revision=$3',
        [journeyId, input.assessmentVersion, input.assessmentRevision],
      );
      const previous = prior.rows[0];
      if (
        previous &&
        !isDeepStrictEqual(receiptSchema.parse(previous.receipt), receipt)
      )
        throw new ApiError(
          409,
          'A retained assessment cannot change its calculation basis.',
        );
      const state = await client.query<{
        cumulative_automatic_credit: number;
        receipt: unknown;
      }>(
        `SELECT s.cumulative_automatic_credit, a.receipt FROM app.journey_award_state s
         JOIN app.journey_award_assessments a ON a.id=s.latest_receipt_id
         WHERE s.journey_id=$1 AND s.profile_id=$2 FOR UPDATE OF s`,
        [journeyId, profile.id],
      );
      const previousState = state.rows[0];
      if (previousState) {
        const latest = receiptSchema.parse(previousState.receipt);
        if (
          latest.assessmentIdentity.version !== input.assessmentVersion ||
          latest.assessmentIdentity.revision > input.assessmentRevision
        )
          throw new ApiError(
            409,
            'Assessment must advance within the retained evidence policy.',
          );
        if (
          !isDeepStrictEqual(latest.basis, receipt.basis) ||
          !isDeepStrictEqual(latest.earningPolicy, receipt.earningPolicy) ||
          !isDeepStrictEqual(latest.selectedLegs, receipt.selectedLegs) ||
          !isDeepStrictEqual(latest.source, receipt.source) ||
          !isDeepStrictEqual(latest.policy, receipt.policy) ||
          !isDeepStrictEqual(latest.routeEvidence, receipt.routeEvidence)
        )
          throw new ApiError(
            409,
            'Journey start calculation basis is immutable.',
          );
      }
      const creditedBefore = points.parse(
        previousState?.cumulative_automatic_credit ?? 0,
      );
      const decision = result.decision;
      const targetPoints =
        decision.kind === 'full'
          ? decision.calculation.targetPoints
          : decision.kind === 'fallback'
            ? decision.targetPoints
            : 0;
      const preliminary = await readPhotoPreliminary(
        client,
        profile.id,
        journeyId,
      );
      const creditedPoints =
        creditContext === 'synthetic_test'
          ? remainingJourneyAward(targetPoints, creditedBefore, preliminary)
          : 0;
      const cumulativeAutomaticCredit =
        Math.max(creditedBefore, preliminary) + creditedPoints;
      const receiptId = previous?.id ?? randomUUID();
      if (!previous)
        await client.query(
          `INSERT INTO app.journey_award_assessments(id,journey_id,profile_id,assessment_version,assessment_revision,operation_id,receipt)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            receiptId,
            journeyId,
            profile.id,
            input.assessmentVersion,
            input.assessmentRevision,
            operationId,
            receipt,
          ],
        );
      await client.query(
        `INSERT INTO app.journey_award_state(journey_id,profile_id,cumulative_automatic_credit,latest_receipt_id)
         VALUES ($1,$2,$3,$4) ON CONFLICT (journey_id) DO UPDATE
         SET cumulative_automatic_credit=EXCLUDED.cumulative_automatic_credit, latest_receipt_id=EXCLUDED.latest_receipt_id`,
        [journeyId, profile.id, cumulativeAutomaticCredit, receiptId],
      );
      const reason =
        creditContext === 'production_unavailable'
          ? 'Journey calculation retained; production credit pending trusted factor and calibration validation.'
          : creditedPoints > 0
            ? `Synthetic test journey ${creditedBefore > 0 ? 'top-up' : decision.kind} credit; ${decision.kind === 'fallback' ? 'insufficient evidence retained' : 'configured assessment retained'}, no physical travel claim.`
            : `Synthetic test journey ${decision.kind}; no additional automatic credit.`;
      return {
        delta: creditedPoints,
        reason,
        outcome: {
          receipt,
          creditContext,
          targetPoints,
          creditedPoints,
          cumulativeAutomaticCredit,
        },
      };
    },
  });
}
