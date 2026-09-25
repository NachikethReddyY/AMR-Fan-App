// Synthetic, server-supplied route data for tests; never a recorded journey.
export function routeFixture(fetchedAtMs = Date.now()) {
  return {
    routeId: 'synthetic-bus',
    routeEvidence: {
      primaryMode: 'TRANSIT',
      factorApplicability: 'singapore_indicative',
      geographyVersion: 'synthetic-geography-v1',
    },
    source: { kind: 'fixture', label: 'Synthetic journey test' },
    fetchedAt: new Date(fetchedAtMs).toISOString(),
    query: {
      origin: 'Fixture origin',
      destination: 'Fixture destination',
      modes: ['TRANSIT', 'DRIVE'],
      extraMinutes: 10,
    },
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
      calculation: {
        kind: 'available',
        baseline: {
          routeId: 'synthetic-car',
          queryBinding: 'same_server_query',
          legs: [{ mode: 'car', distanceMeters: 1500, durationSeconds: 200 }],
          distanceMeters: 1500,
          durationSeconds: 200,
        },
        factors: [
          {
            id: 'synthetic-factor-v1',
            mode: 'bus',
            kgCo2ePerPassengerKm: 0.07,
            geography: 'Singapore',
            period: 'synthetic',
            source: 'https://example.test/factor',
            method: 'Synthetic arithmetic fixture',
            assumptions: 'No real travel claim',
            status: 'indicative_demo',
          },
        ],
        earningRule: {
          version: 'initial-50-cap-2000-v1',
          pointsPerKg: 50,
          journeyCap: 2000,
        },
      },
    },
  };
}
