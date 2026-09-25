import type { LegMode, RouteOption } from './routes';

export type EmissionFactor = {
  id: string;
  mode: LegMode;
  kgCo2ePerPassengerKm: number;
  geography: 'Singapore';
  period: string;
  source: string;
  method: string;
  assumptions: string;
  status: 'indicative_demo';
};

const changiReport =
  'https://www.changiairport.com/content/dam/changiairport/common/pdf/publications/2024-25/cag-ar-2024-25-beyond-boundaries-transforming-tomorrow-oct.pdf';
const activeTravelSource =
  'https://www.lta.gov.sg/content/dam/ltagov/who_we_are/statistics_and_publications/master-plans/pdf/LTMP2013Report.pdf';

// These are indicative Singapore surface-access factors, not official team metrics or approved award factors.
export const singaporeFactors: readonly EmissionFactor[] = [
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
  ...(['walk', 'cycle'] as const).map((mode): EmissionFactor => ({
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
      kind: 'unavailable';
      reason: 'route_unavailable' | 'invalid_route' | 'missing_factor';
      mode?: LegMode;
    };

export function estimateRoute(
  route: RouteOption,
  factors: readonly EmissionFactor[],
): RouteEstimate {
  if (route.availability.kind === 'unavailable')
    return { kind: 'unavailable', reason: 'route_unavailable' };
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
    route.legs.reduce((sum, leg) => sum + leg.distanceMeters, 0) <= 0
  ) {
    return { kind: 'unavailable', reason: 'invalid_route' };
  }

  let kgCo2e = 0;
  const factorIds: string[] = [];
  for (const leg of route.legs) {
    const factor = factors.find(
      (entry) => entry.mode === leg.mode && entry.geography === 'Singapore',
    );
    if (
      !factor ||
      !Number.isFinite(factor.kgCo2ePerPassengerKm) ||
      factor.kgCo2ePerPassengerKm < 0
    ) {
      return { kind: 'unavailable', reason: 'missing_factor', mode: leg.mode };
    }
    kgCo2e += (leg.distanceMeters / 1000) * factor.kgCo2ePerPassengerKm;
    factorIds.push(factor.id);
  }
  return { kind: 'estimated', kgCo2e, factorIds };
}
