import { routeWarning } from './route-warning';
test('Google walking and cycling legs carry beta path warning, including transit connections', () => {
  for (const modes of [['walk'], ['cycle'], ['walk', 'bus']]) {
    expect(
      routeWarning({ kind: 'live', provider: 'Google Routes' }, modes),
    ).toContain('Sidewalks, pedestrian paths or cycling paths may be missing');
  }
  expect(
    routeWarning({ kind: 'live', provider: 'Google Routes' }, ['car']),
  ).toBeNull();
  expect(
    routeWarning({ kind: 'live', provider: 'OneMap' }, ['walk']),
  ).toBeNull();
});
