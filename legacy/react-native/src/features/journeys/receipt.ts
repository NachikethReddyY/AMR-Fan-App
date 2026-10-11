import type { Award } from './contracts';
export function receiptText(award: Award) {
  const { decision, productionCredit } = award.receipt.result;
  const provisional =
    award.creditContext === 'provisional' ||
    productionCredit.kind === 'provisional';
  const label =
    award.creditContext === 'synthetic_test'
      ? 'Synthetic test points'
      : provisional
        ? 'Provisional points'
        : productionCredit.kind === 'unavailable'
          ? 'Points unavailable'
          : 'Journey points';
  const basis =
    decision.kind === 'provisional' ||
    (decision.kind === 'fallback' && provisional)
      ? `Based on the retained planned route estimate: ${decision.calculation.savingsKg} kg ${decision.calculation.measurement?.gas ?? 'CO2e'} avoided. Excluded from verified impact.`
      : decision.kind === 'full'
        ? 'Based on the recorded journey assessment.'
        : decision.kind === 'fallback'
          ? 'Limited points because journey evidence is incomplete.'
          : decision.kind === 'no_award'
            ? decision.reason.replaceAll('_', ' ')
            : decision.reasons.join(', ').replaceAll('_', ' ');
  return {
    label,
    basis,
    detail:
      productionCredit.kind === 'unavailable'
        ? productionCredit.reasons.join(', ').replaceAll('_', ' ')
        : productionCredit.kind === 'provisional'
          ? `Provisional policy ${productionCredit.policyVersion}. Factor release ${productionCredit.factorReleaseVersion}.`
          : null,
  };
}
