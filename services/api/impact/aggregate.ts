import { fingerprint } from '../awards/readiness.ts';
import type { AwardReceipt } from '../awards/contracts.ts';
import { add, decimal, decimalString } from '../awards/decimal.ts';
import type { ImpactSource, ImpactTotal } from './contracts.ts';

type Reason = Extract<ImpactTotal, { kind: 'unavailable' }>['reasons'][number];
export type EstimatePolicy =
  'require_readiness' | 'allow_unvalidated_estimates';
// Server-owned decision. A client cannot opt into a less restrictive policy.
export const estimatePolicy: EstimatePolicy = 'allow_unvalidated_estimates';
export type Contribution =
  | {
      kind: 'eligible';
      savingsKg: string;
      sources?: ImpactSource[];
      validation?: 'reviewed_release' | 'unvalidated_estimate';
    }
  | { kind: 'unavailable'; reason: Reason }
  | { kind: 'excluded' };

export function classifyReceipt(
  receipt: AwardReceipt,
  policy: EstimatePolicy = estimatePolicy,
): Contribution {
  if (receipt.source.kind === 'fixture') return { kind: 'excluded' };
  const decision = receipt.result.decision;
  if (decision.kind === 'no_award')
    return receipt.assessment.status === 'insufficient_evidence' ||
      decision.reason === 'validated_endpoints_required' ||
      decision.reason === 'not_missing_intervening_evidence'
      ? { kind: 'unavailable', reason: 'insufficient_evidence' }
      : { kind: 'excluded' };
  if (decision.kind === 'fallback')
    return { kind: 'unavailable', reason: 'insufficient_evidence' };
  const assessed =
    decision.kind === 'full'
      ? decision.calculation
      : decision.kind === 'provisional'
        ? decision.assessedCalculation
        : null;
  if (!assessed)
    return { kind: 'unavailable', reason: 'calculation_unavailable' };
  if (
    policy === 'require_readiness' &&
    receipt.result.productionCredit.kind !== 'ready'
  )
    return { kind: 'unavailable', reason: 'validation_pending' };
  if (
    receipt.assessment.status !== 'satisfies_configured_rules' ||
    receipt.assessment.reasons.length > 0
  )
    return { kind: 'unavailable', reason: 'insufficient_evidence' };
  const calculation = receipt.basis.calculation;
  if (
    calculation.kind !== 'available' ||
    receipt.assessedLegs.kind !== 'available'
  )
    return { kind: 'unavailable', reason: 'calculation_unavailable' };
  if (!assessed.measurement)
    return { kind: 'unavailable', reason: 'incompatible_measurement' };
  const release = receipt.basis.factorRelease;
  if (
    !release ||
    release.factorEvidence.boundary !== 'published_surface_access' ||
    release.factorFingerprint !== fingerprint(calculation.factors)
  )
    return { kind: 'unavailable', reason: 'factors_unapproved' };
  const evidence = release.factorEvidence;
  const usedModes = new Set(
    [...calculation.baseline.legs, ...receipt.assessedLegs.legs].map(
      (leg) => leg.mode,
    ),
  );
  const factors = calculation.factors.filter((factor) =>
    usedModes.has(factor.mode),
  );
  if (
    receipt.basis.factorStatus !== 'approved' ||
    [...usedModes].some(
      (mode) => factors.filter((f) => f.mode === mode).length !== 1,
    ) ||
    factors.some(
      (factor) =>
        factor.status !== 'approved' ||
        !('gas' in factor) ||
        evidence.units.filter((unit) => unit.factorId === factor.id).length !==
          1,
    )
  )
    return { kind: 'unavailable', reason: 'factors_unapproved' };
  return {
    kind: 'eligible',
    savingsKg: assessed.savingsKg,
    validation:
      receipt.result.productionCredit.kind !== 'ready'
        ? 'unvalidated_estimate'
        : 'reviewed_release',
    sources: factors.map(({ id, source, period, method, assumptions }) => {
      const unit = evidence.units.find((unit) => unit.factorId === id);
      if (!unit) throw new Error('Missing retained factor unit.');
      return {
        id,
        source,
        period,
        method,
        assumptions,
        releaseVersion: release.version,
        sourceValue: unit.sourceValue,
        sourceUnit: unit.sourceUnit,
        publishedUnit: unit.publishedUnit,
        occupants: unit.occupants,
      };
    }),
  };
}

export function createSummary() {
  let total = decimal(0);
  let journeyCount = 0;
  let excludedJourneys = 0;
  const reasons = new Set<Reason>();
  function include(contribution: Contribution) {
    if (contribution.kind === 'unavailable') {
      reasons.add(contribution.reason);
      excludedJourneys++;
    }
    if (contribution.kind !== 'eligible') return;
    // Preserve the receipt's exact decimal text; Number() would lose precision.
    const [whole, fraction = ''] = contribution.savingsKg.split('.');
    total = add(total, {
      units: BigInt(whole + fraction),
      scale: fraction.length,
    });
    journeyCount++;
  }
  function totalResult(): ImpactTotal {
    if (journeyCount)
      return {
        kind: 'available',
        savingsKg: decimalString(total),
        journeyCount,
        excludedJourneys,
      };
    return reasons.size
      ? { kind: 'unavailable', reasons: [...reasons].sort() }
      : { kind: 'empty' };
  }

  return { include, total: totalResult };
}

export function summarizeContributions(
  contributions: Contribution[],
): ImpactTotal {
  const summary = createSummary();
  contributions.forEach(summary.include);
  return summary.total();
}
