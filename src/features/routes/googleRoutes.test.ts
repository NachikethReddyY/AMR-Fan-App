/// <reference types="jest" />
import { normalizeGoogleRoutes } from './googleRoutes';

describe('Google Routes normalization', () => {
  it('retains walking and train steps from a transit response', () => {
    const result = normalizeGoogleRoutes('train', {
      routes: [
        {
          distanceMeters: 1200,
          duration: '900s',
          legs: [
            {
              steps: [
                {
                  travelMode: 'WALK',
                  distanceMeters: 200,
                  staticDuration: '180s',
                },
                {
                  travelMode: 'TRANSIT',
                  distanceMeters: 1000,
                  staticDuration: '600s',
                  transitDetails: {
                    transitLine: { vehicle: { type: 'SUBWAY' } },
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(result.kind).toBe('routes');
    if (result.kind !== 'routes') return;
    expect(result.routes[0].legs.map((leg) => leg.mode)).toEqual([
      'walk',
      'train',
    ]);
    expect(result.routes[0].durationSeconds).toBe(900);
  });

  it('does not turn missing step distances into zero or label a train preference as a bus route', () => {
    const result = normalizeGoogleRoutes('train', {
      routes: [
        {
          distanceMeters: 1000,
          duration: '600s',
          legs: [
            {
              steps: [
                {
                  travelMode: 'TRANSIT',
                  staticDuration: '500s',
                  transitDetails: { transitLine: { vehicle: { type: 'BUS' } } },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(result).toEqual({ kind: 'unavailable', reason: 'missing_data' });
  });

  it('keeps an empty response distinct from malformed data', () => {
    expect(normalizeGoogleRoutes('car', { routes: [] })).toEqual({
      kind: 'unavailable',
      reason: 'no_route',
    });
    expect(normalizeGoogleRoutes('car', {})).toEqual({
      kind: 'unavailable',
      reason: 'missing_data',
    });
  });
});
