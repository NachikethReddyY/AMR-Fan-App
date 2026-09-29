import type { Journey } from './contracts';
export const walkingCyclingWarning =
  'Google walking and cycling routes are in beta. Sidewalks, pedestrian paths or cycling paths may be missing.';
export function routeWarning(
  source: Journey['source'],
  modes: readonly string[],
) {
  return source.kind === 'live' &&
    source.provider === 'Google Routes' &&
    modes.some((mode) => mode === 'walk' || mode === 'cycle')
    ? walkingCyclingWarning
    : null;
}
