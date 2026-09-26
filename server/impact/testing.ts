import { awardRoute } from '../awards/testing/fixtures.ts';
import { fingerprint } from '../awards/readiness.ts';
import { routeSchema } from '../journeys/contracts.ts';

// Synthetic arithmetic values, never the published dataset or physical proof.
export function impactRoute(kg = 2.4, now = Date.now()) {
  const route = awardRoute(kg, now);
  if (route.basis.calculation.kind !== 'available') throw new Error('fixture');
  const factors = route.basis.calculation.factors.map((factor) => {
    if (!('kgCo2ePerPassengerKm' in factor)) throw new Error('fixture');
    const { kgCo2ePerPassengerKm, ...metadata } = factor;
    return {
      ...metadata,
      gas: 'CO2',
      unit: 'kgCO2/passenger-km',
      kgPerPassengerKm: kgCo2ePerPassengerKm,
      status: 'approved',
    };
  });
  return routeSchema.parse({
    ...route,
    basis: {
      ...route.basis,
      factorStatus: 'approved',
      calculation: { ...route.basis.calculation, factors },
      factorRelease: {
        version: 'synthetic-impact-co2-v1',
        factorFingerprint: fingerprint(factors),
        geographyVersion: route.routeEvidence.geographyVersion,
        factorEvidence: {
          reference: 'Synthetic Impact test only',
          sha256: 'a'.repeat(64),
          boundary: 'published_surface_access',
          datasetVersion: 'cag-surface-access-co2-v1',
          baseline: 'single_occupant_car',
          gas: 'CO2',
          unit: 'kgCO2/passenger-km',
          compatibility:
            'Synthetic arithmetic only; no published or physical evidence claim.',
          units: factors.map((factor) => ({
            factorId: factor.id,
            sourceValue: factor.kgPerPassengerKm,
            sourceUnit:
              factor.mode === 'car' ? 'kgCO2/vehicle-km' : 'kgCO2/passenger-km',
            publishedUnit:
              factor.mode === 'car'
                ? 'kgCO2e/vehicle-km'
                : 'kgCO2e/passenger-km',
            occupants: 1,
          })),
        },
      },
    },
  });
}
