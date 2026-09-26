import type { LegMode, RouteOption } from './routes.ts';

type FactorMetadata = {
  id: string;
  mode: LegMode;
  geography: 'Singapore';
  period: string;
  source: string;
  method: string;
  assumptions: string;
  status: 'indicative_demo' | 'approved';
};

export type LegacyEmissionFactor = FactorMetadata & {
  kgCo2ePerPassengerKm: number;
};
export type Co2EmissionFactor = FactorMetadata & {
  gas: 'CO2';
  unit: 'kgCO2/passenger-km';
  kgPerPassengerKm: number;
};
export type EmissionFactor = LegacyEmissionFactor | Co2EmissionFactor;
export function factorValue(factor: EmissionFactor) {
  return 'gas' in factor
    ? factor.kgPerPassengerKm
    : factor.kgCo2ePerPassengerKm;
}
export function factorGas(factor: EmissionFactor) {
  return 'gas' in factor ? factor.gas : 'CO2e';
}

const changiReport =
  'https://www.changiairport.com/content/dam/changiairport/common/pdf/publications/2024-25/cag-ar-2024-25-beyond-boundaries-transforming-tomorrow-oct.pdf';
const activeTravelSource =
  'https://www.lta.gov.sg/content/dam/ltagov/who_we_are/statistics_and_publications/master-plans/pdf/LTMP2013Report.pdf';

// These are indicative Singapore surface-access factors, not official team metrics or approved award factors.
export const singaporeFactors: readonly LegacyEmissionFactor[] = [
  {
    id: 'cag-fy2024-25-car',
    mode: 'car',
    kgCo2ePerPassengerKm: 0.17,
    geography: 'Singapore',
    period: 'FY2024/25',
    source: changiReport,
    method: 'CAG Scope 3 surface-access factor, passenger-km',
    assumptions:
      "One passenger driving a conventional combustion car; CAG does not identify this factor's individual upstream dataset or occupancy method.",
    status: 'indicative_demo',
  },
  {
    id: 'cag-fy2024-25-bus',
    mode: 'bus',
    kgCo2ePerPassengerKm: 0.07,
    geography: 'Singapore',
    period: 'FY2024/25',
    source: changiReport,
    method: 'CAG Scope 3 surface-access factor, passenger-km',
    assumptions:
      "Public bus passenger distance; CAG does not identify this factor's individual upstream dataset or occupancy method.",
    status: 'indicative_demo',
  },
  {
    id: 'cag-fy2024-25-mrt',
    mode: 'train',
    kgCo2ePerPassengerKm: 0.01,
    geography: 'Singapore',
    period: 'FY2024/25',
    source: changiReport,
    method: 'CAG Scope 3 surface-access MRT factor, passenger-km',
    assumptions:
      "MRT passenger distance; CAG does not identify this factor's individual upstream dataset or occupancy method.",
    status: 'indicative_demo',
  },
  ...(['walk', 'cycle'] as const).map((mode): LegacyEmissionFactor => ({
    id: `sg-${mode}-operational-v1`,
    mode,
    kgCo2ePerPassengerKm: 0,
    geography: 'Singapore',
    period: '2013 operational illustration',
    source: activeTravelSource,
    method:
      'No motorized journey energy; LTA land transport comparison lists 0 kg CO2 per 10 km',
    assumptions:
      'Operational travel only. Excludes food, bicycle manufacture, infrastructure and other lifecycle emissions.',
    status: 'indicative_demo',
  })),
];

export type RouteEstimate =
  | { kind: 'estimated'; kgCo2e: number; factorIds: string[] }
  | {
      kind: 'estimated_co2';
      gas: 'CO2';
      unit: 'kgCO2';
      kg: number;
      factorIds: string[];
    }
  | {
      kind: 'unavailable';
      reason:
        | 'route_unavailable'
        | 'invalid_route'
        | 'missing_factor'
        | 'incompatible_gases';
      mode?: LegMode;
    };

export function estimateRoute(
  route: RouteOption,
  factors: readonly EmissionFactor[],
): RouteEstimate {
  if (route.availability.kind === 'unavailable')
    return { kind: 'unavailable', reason: 'route_unavailable' };
  const legDistanceMeters = route.legs.reduce(
    (sum, leg) => sum + leg.distanceMeters,
    0,
  );
  if (
    route.legs.length === 0 ||
    route.distanceMeters === null ||
    route.durationSeconds === null ||
    !Number.isFinite(route.distanceMeters) ||
    !Number.isFinite(route.durationSeconds) ||
    route.distanceMeters <= 0 ||
    route.durationSeconds <= 0 ||
    route.legs.some(
      (leg) =>
        !Number.isFinite(leg.distanceMeters) ||
        !Number.isFinite(leg.durationSeconds) ||
        leg.distanceMeters < 0 ||
        leg.durationSeconds < 0,
    ) ||
    !Number.isFinite(legDistanceMeters) ||
    legDistanceMeters <= 0
  ) {
    return { kind: 'unavailable', reason: 'invalid_route' };
  }

  let kg = 0;
  let gas: 'CO2' | 'CO2e' | undefined;
  const factorIds: string[] = [];
  for (const leg of route.legs) {
    const factor = factors.find(
      (entry) => entry.mode === leg.mode && entry.geography === 'Singapore',
    );
    if (
      !factor ||
      !Number.isFinite(factorValue(factor)) ||
      factorValue(factor) < 0
    ) {
      return { kind: 'unavailable', reason: 'missing_factor', mode: leg.mode };
    }
    if (gas && factorGas(factor) !== gas)
      return { kind: 'unavailable', reason: 'incompatible_gases' };
    gas = factorGas(factor);
    const legKgCo2e = (leg.distanceMeters / 1000) * factorValue(factor);
    if (!Number.isFinite(legKgCo2e))
      return { kind: 'unavailable', reason: 'invalid_route' };
    kg += legKgCo2e;
    if (!Number.isFinite(kg))
      return { kind: 'unavailable', reason: 'invalid_route' };
    factorIds.push(factor.id);
  }
  return gas === 'CO2'
    ? { kind: 'estimated_co2', gas: 'CO2', unit: 'kgCO2', kg, factorIds }
    : { kind: 'estimated', kgCo2e: kg, factorIds };
}
