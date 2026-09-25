/// <reference types="jest" />
import { fixtureRoutes, searchFixtureRoutes } from './routes';

const origin = 'Marina Bay Sands, Singapore';
const destination = 'Singapore Botanic Gardens';

describe('route options', () => {
  it('accepts an ordinary Singapore fixture trip with source provenance and normalized legs', () => {
    const result = searchFixtureRoutes({ origin, destination });
    expect(result.kind).toBe('routes');
    if (result.kind !== 'routes') return;
    expect(result.source.kind).toBe('fixture');
    expect(result.routes.length).toBeGreaterThan(0);
    for (const route of result.routes) {
      if (route.availability.kind !== 'available') continue;
      expect(route.legs.length).toBeGreaterThan(0);
      expect(route.distanceMeters).toBeGreaterThan(0);
      expect(route.durationSeconds).toBeGreaterThan(0);
      expect(route.legs.reduce((sum, leg) => sum + leg.distanceMeters, 0)).toBe(
        route.distanceMeters,
      );
    }
  });

  it('preserves distinct bus, train, car, electric-car, and cab outcomes', () => {
    expect(fixtureRoutes.map((route) => route.mode)).toEqual(
      expect.arrayContaining(['bus', 'train', 'car', 'electric_car', 'cab']),
    );
    expect(
      fixtureRoutes.find((route) => route.mode === 'car')?.availability.kind,
    ).toBe('available');
    expect(
      fixtureRoutes.find((route) => route.mode === 'cab')?.availability.kind,
    ).toBe('unavailable');
  });

  it('does not pretend the fixture covers arbitrary destinations', () => {
    expect(
      searchFixtureRoutes({ origin, destination: 'Changi Airport, Singapore' }),
    ).toEqual({
      kind: 'unavailable',
      reason: 'outside_fixture_coverage',
    });
  });

  it('does not reuse the one-way fixture as a return journey', () => {
    expect(
      searchFixtureRoutes({ origin: destination, destination: origin }),
    ).toEqual({
      kind: 'unavailable',
      reason: 'outside_fixture_coverage',
    });
  });
});
