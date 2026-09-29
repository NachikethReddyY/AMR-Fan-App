export type RouteMode =
  'bus' | 'train' | 'car' | 'electric_car' | 'cab' | 'walk' | 'cycle';
export type LegMode =
  'bus' | 'train' | 'car' | 'electric_car' | 'cab' | 'walk' | 'cycle';

export type RouteLeg = {
  mode: LegMode;
  distanceMeters: number;
  durationSeconds: number;
  description: string;
};

export type RouteOption = {
  id: string;
  mode: RouteMode;
  availability: { kind: 'available' } | { kind: 'unavailable'; reason: string };
  legs: RouteLeg[];
  distanceMeters: number | null;
  durationSeconds: number | null;
};

export type RouteQuery = { origin: string; destination: string };
export type RouteResult =
  | {
      kind: 'routes';
      source:
        { kind: 'fixture'; label: string } | { kind: 'live'; provider: string };
      routes: RouteOption[];
    }
  | {
      kind: 'unavailable';
      reason:
        | 'outside_fixture_coverage'
        | 'no_route'
        | 'missing_data'
        | 'provider_error'
        | 'live_not_configured';
    };

function available(id: string, mode: RouteMode, legs: RouteLeg[]): RouteOption {
  return {
    id,
    mode,
    availability: { kind: 'available' },
    legs,
    distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
    durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
  };
}

function unavailable(id: string, mode: RouteMode, reason: string): RouteOption {
  return {
    id,
    mode,
    availability: { kind: 'unavailable', reason },
    legs: [],
    distanceMeters: null,
    durationSeconds: null,
  };
}

// Synthetic demonstration values, not provider observations or timetable claims.
export const fixtureRoutes: RouteOption[] = [
  available('fixture-bus', 'bus', [
    {
      mode: 'walk',
      distanceMeters: 400,
      durationSeconds: 360,
      description: 'Walk to bus stop',
    },
    {
      mode: 'bus',
      distanceMeters: 6200,
      durationSeconds: 1500,
      description: 'Bus ride',
    },
    {
      mode: 'walk',
      distanceMeters: 300,
      durationSeconds: 300,
      description: 'Walk to destination',
    },
  ]),
  available('fixture-train', 'train', [
    {
      mode: 'walk',
      distanceMeters: 650,
      durationSeconds: 600,
      description: 'Walk to station',
    },
    {
      mode: 'train',
      distanceMeters: 5800,
      durationSeconds: 960,
      description: 'Train ride',
    },
    {
      mode: 'walk',
      distanceMeters: 450,
      durationSeconds: 420,
      description: 'Walk to destination',
    },
  ]),
  available('fixture-car', 'car', [
    {
      mode: 'car',
      distanceMeters: 7800,
      durationSeconds: 1140,
      description: 'Drive',
    },
  ]),
  available('fixture-electric-car', 'electric_car', [
    {
      mode: 'electric_car',
      distanceMeters: 7800,
      durationSeconds: 1140,
      description: 'Drive an electric car',
    },
  ]),
  unavailable(
    'fixture-cab',
    'cab',
    'Cab data is not available in this fixture',
  ),
  available('fixture-walk', 'walk', [
    {
      mode: 'walk',
      distanceMeters: 6400,
      durationSeconds: 4800,
      description: 'Walk',
    },
  ]),
  unavailable(
    'fixture-cycle',
    'cycle',
    'Cycling data is not available in this fixture',
  ),
];

const fixtureOrigin = 'marina bay sands, singapore';
const fixtureDestination = 'singapore botanic gardens';

export function searchFixtureRoutes(query: RouteQuery): RouteResult {
  const origin = query.origin.trim().toLowerCase();
  const destination = query.destination.trim().toLowerCase();
  const matches =
    origin === fixtureOrigin && destination === fixtureDestination;
  if (!matches)
    return { kind: 'unavailable', reason: 'outside_fixture_coverage' };
  return {
    kind: 'routes',
    source: {
      kind: 'fixture',
      label:
        'Demo routes. Illustrative distances and times; no live provider data.',
    },
    routes: fixtureRoutes,
  };
}

export function createFixtureRouteProvider() {
  return {
    search: async (query: RouteQuery): Promise<RouteResult> =>
      searchFixtureRoutes(query),
  };
}

export type RouteProvider = ReturnType<typeof createFixtureRouteProvider>;
