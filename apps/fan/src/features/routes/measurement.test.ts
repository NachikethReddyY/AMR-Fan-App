import { parseComparison } from './api';
import { estimateLabel, recommendationLabels } from './measurement';
const route = {
  id: 'walk-1',
  mode: 'walk',
  availability: { kind: 'available' },
  distanceMeters: 1000,
  durationSeconds: 600,
  legs: [
    {
      mode: 'walk',
      distanceMeters: 1000,
      durationSeconds: 600,
      description: 'Walk',
    },
  ],
};
const co2 = {
  kind: 'estimated_co2',
  gas: 'CO2',
  unit: 'kgCO2',
  kg: 0,
  factorIds: ['co2-walk'],
};
const legacy = { kind: 'estimated', kgCo2e: 0, factorIds: ['legacy-walk'] };
function payload(isCo2 = true) {
  const estimate = isCo2 ? co2 : legacy;
  return {
    result: {
      kind: 'routes',
      source: { kind: 'fixture', label: 'Synthetic' },
      routes: [route],
    },
    estimates: [{ routeId: route.id, estimate }],
    recommendation: {
      route,
      estimate,
      baseline: isCo2 ? { ...co2, kg: 0.1901 } : { ...legacy, kgCo2e: 0.17 },
      baselineDistanceMeters: 1000,
      fastestSeconds: 300,
      limitSeconds: 1200,
      ...(isCo2
        ? {
            kind: 'recommended_co2',
            gas: 'CO2',
            unit: 'kgCO2',
            avoidedKg: 0.1901,
          }
        : { kind: 'recommended', avoidedKgCo2e: 0.17 }),
    },
    factors: [],
    unsupportedModes: ['cab', 'electric_car'],
    calculationStatus: 'indicative_demo',
  };
}
test.each(['indicative_demo', 'approved'])(
  'CO2 and legacy CO2e retain separate numbers, discriminants and labels for %s',
  (calculationStatus) => {
    for (const isCo2 of [true, false]) {
      const parsed = parseComparison({ ...payload(isCo2), calculationStatus });
      expect(parsed.calculationStatus).toBe(calculationStatus);
      expect(estimateLabel(parsed.estimates[0].estimate)).toBe(
        isCo2 ? '0.00 kg CO2 estimated' : '0.00 kg CO2e estimated',
      );
      if (parsed.recommendation.kind === 'unavailable')
        throw new Error('Recommendation lost');
      expect(recommendationLabels(parsed.recommendation).avoided).toBe(
        isCo2
          ? '0.19 kg estimated CO2 avoided'
          : '0.17 kg estimated CO2e avoided',
      );
    }
  },
);
test('mixed gas, wrong unit and unknown transport versions fail closed', () => {
  const raw = payload();
  for (const estimate of [
    { ...co2, gas: 'CO2e' },
    { ...co2, unit: 'kgCO2e' },
    { ...co2, kind: 'estimated_future' },
  ])
    expect(() =>
      parseComparison({ ...raw, estimates: [{ routeId: route.id, estimate }] }),
    ).toThrow();
  expect(() =>
    parseComparison({
      ...raw,
      recommendation: { ...raw.recommendation, baseline: legacy },
    }),
  ).toThrow();
});
test('a CO2 recommendation must refer to the exact returned route and estimate', () => {
  const raw = payload();
  expect(() =>
    parseComparison({
      ...raw,
      recommendation: {
        ...raw.recommendation,
        route: { ...route, id: 'unknown' },
      },
    }),
  ).toThrow();
  expect(() =>
    parseComparison({
      ...raw,
      estimates: [{ routeId: route.id, estimate: legacy }],
    }),
  ).toThrow();
});
