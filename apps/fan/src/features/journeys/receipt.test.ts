import { awardSchema } from './contracts';
import { receiptText } from './receipt';
const calculation = {
  arithmeticVersion: 'floor-decimal-v1',
  baselineKg: '1',
  journeyKg: '0.2',
  savingsKg: '0.8',
  targetPoints: 40,
};
function award(
  decision: unknown,
  productionCredit: unknown = {
    kind: 'provisional',
    policyVersion: 'planned-endpoints-v1',
    factorReleaseVersion: 'reviewed-1',
  },
) {
  return awardSchema.parse({
    creditedPoints: 10,
    cumulativeAutomaticCredit: 40,
    targetPoints: 40,
    creditContext: 'provisional',
    receipt: {
      journeyId: '00000000-0000-4000-8000-000000000001',
      profileId: '00000000-0000-4000-8000-000000000002',
      result: { decision, productionCredit },
    },
  });
}
test('provisional points disclose retained planned estimate and never relabel it as assessed', () => {
  const parsed = award({
    kind: 'provisional',
    calculation,
    assessedCalculation: null,
  });
  const text = receiptText(parsed);
  expect(text.label).toBe('Provisional points');
  expect(text.basis).toContain('retained planned route estimate: 0.8 kg');
  expect(text.basis).toContain('Excluded from verified impact');
  expect(parsed.creditedPoints).toBe(10);
  expect(parsed.cumulativeAutomaticCredit).toBe(40);
});
test('fallback with provisional production context keeps the provisional label and planned basis', () => {
  const text = receiptText(
    award({ kind: 'fallback', calculation, targetPoints: 40 }),
  );
  expect(text.label).toBe('Provisional points');
  expect(text.basis).toContain('planned route estimate');
});
test('unavailable credit cannot be presented as earned and invalid numeric calculations fail parsing', () => {
  const parsed = award(
    { kind: 'unavailable', reasons: ['factors_unavailable'] },
    { kind: 'unavailable', reasons: ['factors_unavailable'] },
  );
  parsed.creditContext = 'production_unavailable';
  expect(receiptText(parsed).label).toBe('Points unavailable');
  expect(() =>
    award({
      kind: 'provisional',
      calculation: { ...calculation, savingsKg: 'Infinity' },
      assessedCalculation: null,
    }),
  ).toThrow();
});
test('explicit CO2 measurement labels only new receipts, and absence preserves legacy CO2e', () => {
  const legacy = award({
    kind: 'provisional',
    calculation,
    assessedCalculation: null,
  });
  expect(receiptText(legacy).basis).toContain('0.8 kg CO2e avoided');
  const measured = {
    ...calculation,
    measurement: {
      version: 'cag-surface-access-co2-v1',
      gas: 'CO2',
      unit: 'kgCO2',
    },
  };
  const current = award({
    kind: 'provisional',
    calculation: measured,
    assessedCalculation: null,
  });
  expect(receiptText(current).basis).toContain('0.8 kg CO2 avoided');
  expect(() =>
    award({
      kind: 'provisional',
      calculation: {
        ...measured,
        measurement: { ...measured.measurement, gas: 'CO2e' },
      },
      assessedCalculation: null,
    }),
  ).toThrow();
});
