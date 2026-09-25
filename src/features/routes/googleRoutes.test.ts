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

describe('Google Routes untrusted mode values', () => {
  function response(travelMode: unknown, vehicleType?: unknown) {
    return {
      routes: [
        {
          distanceMeters: 1000,
          duration: '600s',
          legs: [
            {
              steps: [
                {
                  travelMode,
                  distanceMeters: 1000,
                  staticDuration: '600s',
                  transitDetails: {
                    transitLine: { vehicle: { type: vehicleType } },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  it('returns missing data for non-string transit vehicle types without throwing', () => {
    expect(
      normalizeGoogleRoutes('train', response('TRANSIT', { toString: 0 })),
    ).toEqual({ kind: 'unavailable', reason: 'missing_data' });
    expect(
      normalizeGoogleRoutes('train', response('TRANSIT', ['SUBWAY'])),
    ).toEqual({ kind: 'unavailable', reason: 'missing_data' });
  });

  it.each(['HEAVY_RAIL', 'COMMUTER_TRAIN'])(
    'keeps documented %s rail as train',
    (vehicleType) => {
      const result = normalizeGoogleRoutes(
        'train',
        response('TRANSIT', vehicleType),
      );
      expect(result.kind).toBe('routes');
      if (result.kind !== 'routes') return;
      expect(result.routes[0].mode).toBe('train');
      expect(result.routes[0].legs[0].mode).toBe('train');
    },
  );

  it.each([
    ['car', 'WALK'],
    ['electric_car', 'WALK'],
    ['electric_car', 'BICYCLE'],
    ['cycle', 'DRIVE'],
  ] as const)(
    'rejects %s requested with a returned %s step',
    (requested, travelMode) => {
      expect(normalizeGoogleRoutes(requested, response(travelMode))).toEqual({
        kind: 'unavailable',
        reason: 'missing_data',
      });
    },
  );

  it('classifies transit by returned rail leg despite bus preference', () => {
    const result = normalizeGoogleRoutes('bus', response('TRANSIT', 'SUBWAY'));
    expect(result.kind).toBe('routes');
    if (result.kind !== 'routes') return;
    expect(result.routes[0].mode).toBe('train');
  });

  it('retains mixed walking, bus and rail step order and labels by longer transit distance', () => {
    const result = normalizeGoogleRoutes('bus', {
      routes: [
        {
          distanceMeters: 1500,
          duration: '900s',
          legs: [
            {
              steps: [
                {
                  travelMode: 'WALK',
                  distanceMeters: 100,
                  staticDuration: '100s',
                },
                {
                  travelMode: 'TRANSIT',
                  distanceMeters: 400,
                  staticDuration: '300s',
                  transitDetails: { transitLine: { vehicle: { type: 'BUS' } } },
                },
                {
                  travelMode: 'TRANSIT',
                  distanceMeters: 1000,
                  staticDuration: '500s',
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
      'bus',
      'train',
    ]);
    expect(result.routes[0].mode).toBe('train');
  });

  it('retains ordinary driving as car, never cab', () => {
    const result = normalizeGoogleRoutes('car', response('DRIVE'));
    expect(result.kind).toBe('routes');
    if (result.kind !== 'routes') return;
    expect(result.routes[0].mode).toBe('car');
    expect(result.routes[0].legs[0].mode).toBe('car');
  });

  it('does not label a returned driving step as walking', () => {
    expect(normalizeGoogleRoutes('walk', response('DRIVE'))).toEqual({
      kind: 'unavailable',
      reason: 'missing_data',
    });
  });
});
