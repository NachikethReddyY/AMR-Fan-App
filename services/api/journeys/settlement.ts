import type { PoolClient } from 'pg';
import { lockOwnedProfile } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';
import { id, parse, summarySchema, type Journey } from './contracts.ts';

export type JourneySettlementProjection = Pick<
  Journey,
  | 'id'
  | 'profileId'
  | 'state'
  | 'source'
  | 'mode'
  | 'basis'
  | 'routeEvidence'
  | 'selectedLegs'
  | 'assessedLegs'
  | 'earningPolicy'
  | 'policy'
  | 'awardRelease'
  | 'awardPolicy'
  | 'startedAtMs'
  | 'finishedAtMs'
  | 'finishReason'
  | 'assessment'
> & {
  assessmentIdentity: { journeyId: string; version: string; revision: number };
};

// Caller must already hold current authority and its request lock in a transaction.
// Reacquiring its owned profile lock is safe; all writers lock profile before journey.
// No transaction, network call, geometry read, award or balance effect occurs here.
export async function lockJourneyForSettlement(
  client: PoolClient,
  principalId: string,
  profileId: string,
  journeyId: string,
): Promise<JourneySettlementProjection> {
  const ownedProfile = await lockOwnedProfile(
    client,
    parse(id, principalId),
    parse(id, profileId),
  );
  const row = await client.query<{ summary: unknown }>(
    'SELECT summary FROM app.journeys WHERE id=$1 AND profile_id=$2 FOR UPDATE',
    [parse(id, journeyId), ownedProfile.id],
  );
  if (!row.rows[0]) throw new ApiError(404, 'Journey not found.');
  const journey = parse(summarySchema, row.rows[0].summary);
  const {
    id: selectedId,
    state,
    source,
    mode,
    basis,
    routeEvidence,
    selectedLegs,
    assessedLegs,
    earningPolicy,
    policy,
    awardRelease,
    awardPolicy,
    startedAtMs,
    finishedAtMs,
    finishReason,
    assessment,
  } = journey;
  return {
    id: selectedId,
    profileId: ownedProfile.id,
    state,
    source,
    mode,
    basis,
    routeEvidence,
    selectedLegs,
    assessedLegs,
    earningPolicy,
    policy,
    awardRelease,
    awardPolicy,
    startedAtMs,
    finishedAtMs,
    finishReason,
    assessment,
    assessmentIdentity: {
      journeyId: selectedId,
      version: assessment.version,
      revision: assessment.revision,
    },
  };
}
