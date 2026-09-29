import { createTravelController } from './state';
import { parseComparison } from './api';
import { AccountError } from '../account/api';
const empty = {
  result: { kind: 'unavailable', reason: 'live_not_configured' },
  estimates: [],
  recommendation: { kind: 'unavailable', reason: 'no_routes' },
  factors: [],
  unsupportedModes: ['cab', 'electric_car'],
  calculationStatus: 'indicative_demo',
};
test('no configuration is unavailable, not an invented route or zero estimate', () => {
  expect(parseComparison(empty).result.kind).toBe('unavailable');
  expect(() =>
    parseComparison({ ...empty, calculationStatus: 'verified' }),
  ).toThrow();
});
test('changed input discards delayed comparison and old 401', async () => {
  let fail!: (e: Error) => void;
  const pending = new Promise<ReturnType<typeof parseComparison>>(
    (_r, reject) => {
      fail = reject;
    },
  );
  const expired = jest.fn();
  const c = createTravelController(async () => pending, expired);
  const req = c.compare(
    { token: 'A', profileId: 'a' },
    { origin: 'A', destination: 'B', extraMinutes: 15 },
  );
  c.clear();
  fail(new AccountError(401, 'old'));
  await req;
  expect(c.getState().kind).toBe('idle');
  expect(expired).not.toHaveBeenCalled();
});
