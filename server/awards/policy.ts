import { fingerprint, productionReadiness } from './readiness.ts';
import type { JourneySettlementProjection } from '../journeys/settlement.ts';
import { earningPolicy } from '../journeys/contracts.ts';
import type { PolicyResult } from './contracts.ts';
import {
  add,
  decimal,
  decimalString,
  multiply,
  perThousand,
  savings,
  wholePoints,
} from './decimal.ts';

type Legs = JourneySettlementProjection['selectedLegs'];
type Basis = Extract<
  JourneySettlementProjection['basis']['calculation'],
  { kind: 'available' }
>;

function emissions(legs: Legs, basis: Basis, versions: string[]) {
  let total = decimal(0);
  for (const leg of legs) {
    const factors = basis.factors.filter((factor) => factor.mode === leg.mode);
    if (factors.length !== 1) return null;
    const factor = factors[0];
    if (!versions.includes(factor.id)) return null;
    total = add(
      total,
      perThousand(
        multiply(
          decimal(leg.distanceMeters),
          decimal(factor.kgCo2ePerPassengerKm),
        ),
      ),
    );
  }
  return total;
}

export function calculateJourneyAward(
  journey: JourneySettlementProjection,
): PolicyResult {
  const result = (decision: PolicyResult['decision']): PolicyResult => ({
    decision,
    productionCredit: productionReadiness(journey, decision),
  });
  const unavailable = (reason: string) =>
    result({ kind: 'unavailable', reasons: [reason] });
  if (
    journey.state !== 'finished' ||
    journey.startedAtMs === null ||
    journey.finishedAtMs === null
  )
    return result({ kind: 'no_award', reason: 'journey_unfinished' });
  const assessment = journey.assessment;
  if (
    journey.assessmentIdentity.journeyId !== journey.id ||
    journey.assessmentIdentity.version !== assessment.version ||
    journey.assessmentIdentity.revision !== assessment.revision ||
    journey.policy.version !== assessment.version
  )
    return unavailable('assessment_identity_mismatch');
  if (
    assessment.status !== 'satisfies_configured_rules' &&
    assessment.status !== 'insufficient_evidence'
  )
    return result({ kind: 'no_award', reason: assessment.status });
  if (
    journey.finishReason !== 'arrival' ||
    !assessment.startRecorded ||
    !assessment.arrivalRecorded ||
    journey.finishedAtMs <= journey.startedAtMs
  )
    return result({ kind: 'no_award', reason: 'validated_endpoints_required' });
  const provisional = journey.awardPolicy?.kind === 'provisional';
  const fallback = assessment.status === 'insufficient_evidence';
  // Missing middle samples can also explain zero measured movement. Other
  // uncertainty/contradiction reasons do not establish this fallback's condition.
  if (
    fallback &&
    (!assessment.reasons.includes('continuity_gap') ||
      assessment.reasons.some(
        (reason) =>
          reason !== 'continuity_gap' && reason !== 'insufficient_movement',
      ))
  )
    return result({
      kind: 'no_award',
      reason: 'not_missing_intervening_evidence',
    });
  if (!fallback && assessment.reasons.length !== 0)
    return unavailable('inconsistent_assessment');
  const policy = journey.earningPolicy;
  if (
    !policy ||
    policy.version !== earningPolicy.version ||
    policy.arithmeticVersion !== earningPolicy.arithmeticVersion ||
    policy.pointsPerKg !== 50 ||
    policy.journeyCap !== 2000 ||
    journey.basis.earningRuleVersion !== policy.version
  )
    return unavailable('retained_earning_policy_unavailable');
  if (
    journey.routeEvidence.factorApplicability !== 'singapore_indicative' ||
    journey.basis.factorStatus === 'unavailable'
  )
    return unavailable('factor_applicability_unavailable');
  const basis = journey.basis.calculation;
  if (basis.kind === 'unavailable') return unavailable(basis.reason);
  if (
    basis.earningRule.version !== policy.version ||
    basis.earningRule.pointsPerKg !== policy.pointsPerKg ||
    basis.earningRule.journeyCap !== policy.journeyCap
  )
    return unavailable('retained_earning_policy_mismatch');
  if (
    basis.baseline.queryBinding !== 'same_server_query' ||
    basis.baseline.legs.some((leg) => leg.mode !== 'car')
  )
    return unavailable('single_driver_baseline_required');
  if (!fallback && !provisional && journey.assessedLegs.kind === 'unavailable')
    return unavailable(journey.assessedLegs.reason);
  const legs =
    fallback || provisional
      ? journey.selectedLegs
      : journey.assessedLegs.kind === 'available'
        ? journey.assessedLegs.legs
        : [];
  const usedModes = new Set(
    [...basis.baseline.legs, ...legs].map((leg) => leg.mode),
  );
  const usedFactors = basis.factors.filter((factor) =>
    usedModes.has(factor.mode),
  );
  // Legacy datasets need a common documented method. A retained factor review
  // may instead document compatibility across sources; matching hashes bind it.
  const methods = new Set(
    usedFactors.map((factor) =>
      JSON.stringify([
        factor.geography,
        factor.source,
        factor.period,
        factor.method,
      ]),
    ),
  );
  const reviewedFactors =
    (journey.basis.factorRelease?.factorFingerprint ??
      journey.awardRelease?.factorFingerprint) === fingerprint(basis.factors);
  if (!reviewedFactors && methods.size > 1)
    return unavailable('incompatible_factor_basis');
  const baseline = emissions(
    basis.baseline.legs,
    basis,
    journey.basis.factorVersions,
  );
  const traveled = emissions(legs, basis, journey.basis.factorVersions);
  if (!baseline || !traveled) return unavailable('missing_or_ambiguous_factor');
  const calculate = (value: NonNullable<typeof traveled>) => {
    const reduction = savings(baseline, value);
    return {
      arithmeticVersion: policy.arithmeticVersion,
      baselineKg: decimalString(baseline),
      journeyKg: decimalString(value),
      savingsKg: decimalString(reduction),
      targetPoints: wholePoints(
        reduction,
        policy.pointsPerKg,
        policy.journeyCap,
      ),
    };
  };
  const calculation = calculate(traveled);
  let assessedCalculation = null;
  if (provisional && !fallback && journey.assessedLegs.kind === 'available') {
    const assessed = emissions(
      journey.assessedLegs.legs,
      basis,
      journey.basis.factorVersions,
    );
    if (assessed) assessedCalculation = calculate(assessed);
  }
  return result(
    fallback
      ? {
          kind: 'fallback',
          calculation,
          targetPoints: Math.min(50, calculation.targetPoints),
        }
      : provisional
        ? { kind: 'provisional', calculation, assessedCalculation }
        : { kind: 'full', calculation },
  );
}
