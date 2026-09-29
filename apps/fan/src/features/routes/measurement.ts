import type { Comparison } from './api';
type Estimate = Comparison['estimates'][number]['estimate'];
type Recommendation = Exclude<
  Comparison['recommendation'],
  { kind: 'unavailable' }
>;
export function estimateAmount(
  estimate: Exclude<Estimate, { kind: 'unavailable' }>,
) {
  return estimate.kind === 'estimated_co2'
    ? `${estimate.kg.toFixed(2)} kg CO2`
    : `${estimate.kgCo2e.toFixed(2)} kg CO2e`;
}
export function estimateLabel(estimate: Estimate) {
  if (estimate.kind !== 'unavailable')
    return `${estimateAmount(estimate)} estimated`;
  return estimate.reason === 'missing_factor'
    ? 'Emissions estimate unavailable: no compatible factor'
    : 'Emissions estimate unavailable';
}
export function recommendationLabels(recommendation: Recommendation) {
  const co2 = recommendation.kind === 'recommended_co2';
  const avoided = co2 ? recommendation.avoidedKg : recommendation.avoidedKgCo2e;
  const gas = co2 ? 'CO2' : 'CO2e';
  return {
    avoided:
      avoided >= 0
        ? `${avoided.toFixed(2)} kg estimated ${gas} avoided`
        : `${(-avoided).toFixed(2)} kg more ${gas} than driving`,
    basis: co2
      ? 'Changi Airport Group published surface-access CO2 factors. Car baseline assumes one occupant. Not measured savings.'
      : 'Indicative demo estimates. Changi Airport Group FY2024/25 passenger-km factors; walking and cycling count operational travel only. Not measured savings.',
  };
}
