// Synthetic, server-supplied route data for tests; never a recorded journey.
export function routeFixture(fetchedAtMs = Date.now()) {
  return {
    routeId: 'synthetic-bus',
    source: { kind: 'fixture', label: 'Synthetic journey test' },
    fetchedAt: new Date(fetchedAtMs).toISOString(),
    query: { origin: 'Fixture origin', destination: 'Fixture destination' },
    mode: 'bus',
    start: { latitude: 1.3, longitude: 103.8 },
    end: { latitude: 1.31, longitude: 103.8 },
    points: [
      { latitude: 1.3, longitude: 103.8 },
      { latitude: 1.31, longitude: 103.8 },
    ],
    distanceMeters: 1112,
    durationSeconds: 300,
    legs: [{ mode: 'bus', distanceMeters: 1112, durationSeconds: 300 }],
    basis: {
      factorVersions: ['synthetic-factor-v1'],
      factorStatus: 'indicative_demo',
      earningRuleVersion: 'initial-50-cap-2000-v1',
    },
  };
}
