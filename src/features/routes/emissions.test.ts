/// <reference types="jest" />
import { estimateRoute, singaporeFactors } from './emissions';
import type { RouteOption } from './routes';

function route(
  mode: RouteOption['mode'],
  distances: { mode: RouteOption['mode']; meters: number }[],
): RouteOption {
  return {
    id: mode,
    mode,
    availability: { kind: 'available' },
    legs: distances.map(({ mode: legMode, meters }) => ({
      mode: legMode,
      distanceMeters: meters,
      durationSeconds: 600,
      description: legMode,
    })),
    distanceMeters: distances.reduce((sum, leg) => sum + leg.meters, 0),
    durationSeconds: distances.length * 600,
  };
}

describe('Singapore route emissions', () => {
  it('uses compatible passenger-km units and retains factor versions for every leg', () => {
    const estimate = estimateRoute(
      route('bus', [
        { mode: 'walk', meters: 400 },
        { mode: 'bus', meters: 6200 },
        { mode: 'walk', meters: 300 },
      ]),
      singaporeFactors,
    );
    expect(estimate).toMatchObject({
      kind: 'estimated',
      factorIds: [
        'sg-walk-operational-v1',
        'cag-fy2024-25-bus',
        'sg-walk-operational-v1',
      ],
    });
    if (estimate.kind === 'estimated')
      expect(estimate.kgCo2e).toBeCloseTo(0.434, 9);
  });

  it('calculates the one-person driving baseline from its own distance', () => {
    expect(
      estimateRoute(
        route('car', [{ mode: 'car', meters: 7800 }]),
        singaporeFactors,
      ),
    ).toMatchObject({
      kind: 'estimated',
      kgCo2e: 1.326,
    });
  });

  it('keeps missing electric-car and cab factors unavailable', () => {
    for (const mode of ['electric_car', 'cab'] as const) {
      expect(
        estimateRoute(route(mode, [{ mode, meters: 7800 }]), singaporeFactors),
      ).toEqual({
        kind: 'unavailable',
        reason: 'missing_factor',
        mode,
      });
    }
  });

  it('does not treat an incomplete or unavailable route as zero emissions', () => {
    const incomplete = route('train', [{ mode: 'train', meters: 2000 }]);
    incomplete.distanceMeters = null;
    expect(estimateRoute(incomplete, singaporeFactors)).toMatchObject({
      kind: 'unavailable',
      reason: 'invalid_route',
    });
    incomplete.availability = { kind: 'unavailable', reason: 'No train' };
    expect(estimateRoute(incomplete, singaporeFactors)).toMatchObject({
      kind: 'unavailable',
      reason: 'route_unavailable',
    });
  });

  it('uses normalized leg metres when provider totals differ by rounding', () => {
    const normalized = route('train', [
      { mode: 'walk', meters: 0 },
      { mode: 'train', meters: 1000 },
    ]);
    normalized.distanceMeters = 1001;
    normalized.durationSeconds = 1201;
    expect(estimateRoute(normalized, singaporeFactors)).toMatchObject({
      kind: 'estimated',
      kgCo2e: 0.01,
    });
  });

  it('rejects finite leg distances whose aggregate overflows', () => {
    const huge = route('car', [
      { mode: 'car', meters: 1e308 },
      { mode: 'car', meters: 1e308 },
    ]);
    huge.distanceMeters = 1000;
    expect(estimateRoute(huge, singaporeFactors)).toEqual({
      kind: 'unavailable',
      reason: 'invalid_route',
    });
  });

  it('rejects finite factors when a product or the emissions sum overflows', () => {
    const carFactor = singaporeFactors.find((factor) => factor.mode === 'car');
    expect(carFactor).toBeDefined();
    if (!carFactor) return;

    const productOverflow = route('car', [{ mode: 'car', meters: 2000 }]);
    expect(
      estimateRoute(productOverflow, [
        { ...carFactor, kgCo2ePerPassengerKm: Number.MAX_VALUE },
      ]),
    ).toEqual({ kind: 'unavailable', reason: 'invalid_route' });

    const sumOverflow = route('car', [
      { mode: 'car', meters: 1000 },
      { mode: 'car', meters: 1000 },
    ]);
    expect(
      estimateRoute(sumOverflow, [
        { ...carFactor, kgCo2ePerPassengerKm: 1e308 },
      ]),
    ).toEqual({ kind: 'unavailable', reason: 'invalid_route' });
  });
});
