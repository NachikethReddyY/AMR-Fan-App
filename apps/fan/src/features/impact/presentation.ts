import type { ResourceState } from '../account/resource';
import type { parseContributions } from './contracts';
export type ContributionState = ResourceState<
  ReturnType<typeof parseContributions> & { id: string }
>;

const reasons = {
  demo_profile: 'Demo activity is excluded from real travel impact.',
  validation_pending: 'Estimate unavailable: journey validation pending.',
  factors_unapproved:
    'Estimate unavailable: approved emissions factors needed.',
  insufficient_evidence: 'Estimate unavailable: more journey evidence needed.',
  calculation_unavailable: 'Estimate unavailable: calculation data missing.',
  incompatible_measurement:
    'Legacy CO2e estimates are excluded from CO2 totals.',
  assessment_pending: 'Estimate unavailable: journey assessment pending.',
};
export function contributionText(
  state: ContributionState | null,
  scope: 'personal' | 'community' = 'personal',
) {
  if (!state) return 'Sign in to view impact.';
  if (state.kind === 'idle' || state.kind === 'loading')
    return 'Loading impact…';
  if (state.kind === 'error')
    return 'Impact unavailable. Open Impact to retry.';
  const total = state.items[0]?.[scope];
  if (!total) return 'Impact unavailable. Open Impact to retry.';
  if (total.kind === 'empty') return 'No qualifying journeys yet.';
  if (total.kind === 'unavailable')
    return total.reasons.map((reason) => reasons[reason]).join(' ');
  return `Estimated CO2 avoided: ${total.savingsKg} kg · Lifetime`;
}
