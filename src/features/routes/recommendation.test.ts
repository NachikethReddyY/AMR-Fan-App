/// <reference types="jest" />
import { recommendRoute } from './recommendation';
import { singaporeFactors } from './emissions';
import type { RouteOption } from './routes';

function route(
  id: string,
  mode: RouteOption['mode'],
  minutes: number,
  meters: number,
): RouteOption {
  return {
    id,
    mode,
    availability: { kind: 'available' },
    legs: [
      {
        mode,
        distanceMeters: meters,
        durationSeconds: minutes * 60,
        description: mode,
      },
    ],
    distanceMeters: meters,
    durationSeconds: minutes * 60,
  };
}

describe('extra-time recommendation', () => {
  it('chooses lowest emissions within fastest 30 plus 10 minutes, including the boundary', () => {
    const result = recommendRoute(
      [
        route('car', 'car', 30, 10000),
        route('bus', 'bus', 35, 10000),
        route('train', 'train', 40, 10000),
        route('walk', 'walk', 45, 10000),
      ],
      10,
      singaporeFactors,
    );
    expect(result.kind).toBe('recommended');
    if (result.kind !== 'recommended') return;
    expect(result.route.id).toBe('train');
    expect(result.fastestSeconds).toBe(1800);
    expect(result.limitSeconds).toBe(2400);
    expect(result.baseline.kgCo2e).toBeCloseTo(1.7, 9);
    expect(result.avoidedKgCo2e).toBeCloseTo(1.6, 9);
  });

  it('uses exact durations, not rounded display minutes, at a zero-minute limit', () => {
    const result = recommendRoute(
      [
        route('car', 'car', 30, 10000),
        {
          ...route('train', 'train', 30, 10000),
          durationSeconds: 1801,
          legs: [
            {
              mode: 'train',
              distanceMeters: 10000,
              durationSeconds: 1801,
              description: 'train',
            },
          ],
        },
      ],
      0,
      singaporeFactors,
    );
    expect(result.kind === 'recommended' && result.route.id).toBe('car');
  });

  it('uses shortest time then stable id for equal unrounded emissions', () => {
    const routes = [
      route('car', 'car', 20, 10000),
      route('z', 'train', 30, 10000),
      route('b', 'train', 25, 10000),
      route('a', 'train', 25, 10000),
    ];
    for (const order of [routes, [...routes].reverse()]) {
      const result = recommendRoute(order, 10, singaporeFactors);
      expect(result.kind === 'recommended' && result.route.id).toBe('a');
    }
  });

  it('uses fastest available valid route even when its factor is missing', () => {
    const result = recommendRoute(
      [
        route('ev', 'electric_car', 20, 10000),
        route('car', 'car', 35, 10000),
        route('train', 'train', 45, 10000),
      ],
      10,
      singaporeFactors,
    );
    expect(result).toMatchObject({
      kind: 'unavailable',
      reason: 'no_eligible_estimate',
      fastestSeconds: 1200,
      limitSeconds: 1800,
    });
  });

  it('allows inherited provider totals that differ from summed steps', () => {
    const car = route('car', 'car', 30, 10000);
    car.distanceMeters = 1001;
    const train = route('train', 'train', 40, 10000);
    train.durationSeconds = 2401;
    const result = recommendRoute([car, train], 10, singaporeFactors);
    expect(result.kind === 'recommended' && result.route.id).toBe('car');
  });

  it('does not invent avoided emissions without a driving route', () => {
    const result = recommendRoute(
      [route('train', 'train', 30, 10000)],
      0,
      singaporeFactors,
    );
    expect(result).toMatchObject({
      kind: 'unavailable',
      reason: 'missing_baseline',
    });
  });

  it('rejects a driving baseline with finite legs that overflow in aggregate', () => {
    const car = route('car', 'car', 10, 1000);
    car.legs = [
      { ...car.legs[0], distanceMeters: 1e308 },
      { ...car.legs[0], distanceMeters: 1e308 },
    ];
    expect(recommendRoute([car], 0, singaporeFactors)).toEqual({
      kind: 'unavailable',
      reason: 'no_routes',
    });
  });
});
