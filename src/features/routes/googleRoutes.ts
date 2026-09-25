import type {
  LegMode,
  RouteMode,
  RouteOption,
  RouteResult,
  RouteLeg,
} from './routes';

type GoogleRequestMode =
  'bus' | 'train' | 'car' | 'electric_car' | 'walk' | 'cycle';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object(value)
    : null;
}
function nonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
function seconds(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?s$/.test(value)) return null;
  const parsed = Number(value.slice(0, -1));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function transitMode(step: Record<string, unknown>): LegMode | null {
  const details = record(step.transitDetails);
  const line = record(details?.transitLine);
  const vehicle = record(line?.vehicle);
  const type = vehicle?.type;
  if (typeof type !== 'string') return null;
  if (['BUS', 'INTERCITY_BUS', 'TROLLEYBUS'].includes(type)) return 'bus';
  if (
    [
      'SUBWAY',
      'RAIL',
      'METRO_RAIL',
      'TRAM',
      'HEAVY_RAIL',
      'COMMUTER_TRAIN',
      'HIGH_SPEED_TRAIN',
      'LONG_DISTANCE_TRAIN',
      'MONORAIL',
    ].includes(type)
  )
    return 'train';
  return null;
}
function stepMode(
  step: Record<string, unknown>,
  requested: GoogleRequestMode,
): LegMode | null {
  const actual = step.travelMode;
  if (requested === 'bus' || requested === 'train') {
    if (actual === 'WALK') return 'walk';
    if (actual === 'TRANSIT') return transitMode(step);
    return null;
  }
  if (requested === 'walk') return actual === 'WALK' ? 'walk' : null;
  if (requested === 'cycle') return actual === 'BICYCLE' ? 'cycle' : null;
  if (requested === 'electric_car')
    return actual === 'DRIVE' ? 'electric_car' : null;
  return actual === 'DRIVE' ? 'car' : null;
}
function routeMode(
  legs: RouteLeg[],
  requested: GoogleRequestMode,
): RouteMode | null {
  if (requested === 'bus' || requested === 'train') {
    const busDistance = legs
      .filter((leg) => leg.mode === 'bus')
      .reduce((sum, leg) => sum + leg.distanceMeters, 0);
    const trainDistance = legs
      .filter((leg) => leg.mode === 'train')
      .reduce((sum, leg) => sum + leg.distanceMeters, 0);
    if (busDistance === 0 && trainDistance === 0) return null;
    return trainDistance >= busDistance ? 'train' : 'bus';
  }
  return requested;
}

// Parses a server-supplied Google Compute Routes response. Credentials and requests stay server-side.
export function normalizeGoogleRoutes(
  requested: GoogleRequestMode,
  raw: unknown,
): RouteResult {
  const body = record(raw);
  if (!body || !Array.isArray(body.routes))
    return { kind: 'unavailable', reason: 'missing_data' };
  if (body.routes.length === 0)
    return { kind: 'unavailable', reason: 'no_route' };
  const routes: RouteOption[] = [];
  for (const [index, rawRoute] of body.routes.entries()) {
    const route = record(rawRoute);
    const duration = seconds(route?.duration);
    const distance = nonNegative(route?.distanceMeters);
    if (
      !route ||
      duration === null ||
      distance === null ||
      !Array.isArray(route.legs)
    )
      return { kind: 'unavailable', reason: 'missing_data' };
    const legs: RouteLeg[] = [];
    for (const rawLeg of route.legs) {
      const providerLeg = record(rawLeg);
      if (!providerLeg || !Array.isArray(providerLeg.steps))
        return { kind: 'unavailable', reason: 'missing_data' };
      for (const rawStep of providerLeg.steps) {
        const step = record(rawStep);
        if (!step) return { kind: 'unavailable', reason: 'missing_data' };
        const mode = stepMode(step, requested);
        const stepDistance = nonNegative(step.distanceMeters);
        const stepDuration = seconds(step.staticDuration);
        if (!mode || stepDistance === null || stepDuration === null)
          return { kind: 'unavailable', reason: 'missing_data' };
        legs.push({
          mode,
          distanceMeters: stepDistance,
          durationSeconds: stepDuration,
          description:
            mode === 'train'
              ? 'Train ride'
              : mode === 'bus'
                ? 'Bus ride'
                : mode === 'walk'
                  ? 'Walk'
                  : mode === 'cycle'
                    ? 'Cycle'
                    : 'Drive',
        });
      }
    }
    if (legs.length === 0)
      return { kind: 'unavailable', reason: 'missing_data' };
    const mode = routeMode(legs, requested);
    if (!mode) return { kind: 'unavailable', reason: 'missing_data' };
    routes.push({
      id: `google-${requested}-${index}`,
      mode,
      availability: { kind: 'available' },
      legs,
      distanceMeters: distance,
      durationSeconds: duration,
    });
  }
  return {
    kind: 'routes',
    source: { kind: 'live', provider: 'Google Routes' },
    routes,
  };
}
