import { getTestDataView } from './index';
import { exampleActivity } from './fixtures';
import {
  offerSchema,
  purchaseSchema,
  receiptSchema,
} from '../rewards/contracts';

test('every example remains labelled independently of its containing screen', () => {
  const view = getTestDataView();
  expect(view.kind).toBe('test-data');
  expect(view.label).toBe('Test data');
  expect(view.notice).toContain('No points, impact or rewards');
  expect(view.summary.pointsLabel).toBe('1,250 example points');
  expect(view.summary.impactLabel).toBe('30 kg example CO₂ reduction');
  for (const row of [...view.activity, ...view.rewards, ...view.travel]) {
    expect(row.label).toMatch(/^Example: /);
    expect(row.key).toMatch(/^example-/);
  }
});

test('example history reconciles from zero without inventing a starter grant', () => {
  let balance = 0;
  let reduction = 0;
  for (const entry of exampleActivity) {
    balance += entry.points;
    expect(balance).toBeGreaterThanOrEqual(0);
    if (entry.kind === 'journey') {
      reduction += entry.reductionKg;
      expect(entry.points).toBe(entry.reductionKg * 50);
      expect(entry.points).toBeLessThanOrEqual(2000);
    }
  }
  expect(balance).toBe(1250);
  expect(reduction).toBe(30);
  expect(getTestDataView().activity.map((entry) => entry.balanceLabel)).toEqual(
    [
      'Example balance: 1,250 points',
      'Example balance: 1,500 points',
      'Example balance: 1,100 points',
      'Example balance: 600 points',
    ],
  );
});

test('all supported reward kinds are examples with no fulfilled rights', () => {
  const rewards = getTestDataView().rewards;
  expect(rewards.map((row) => row.kind)).toEqual([
    'content',
    'tree',
    'discount',
  ]);
  expect(rewards.find((row) => row.kind === 'content')?.detail).toContain(
    'No content is unlocked',
  );
  expect(rewards.find((row) => row.kind === 'tree')?.detail).toContain(
    'No tree is allocated or planted',
  );
  expect(rewards.find((row) => row.kind === 'discount')?.detail).toContain(
    'No voucher or official offer',
  );
  for (const reward of rewards) {
    expect(reward.priceLabel).toContain('example points');
    expect(offerSchema.safeParse(reward).success).toBe(false);
    expect(purchaseSchema.safeParse(reward).success).toBe(false);
    expect(receiptSchema.safeParse(reward).success).toBe(false);
  }
});

test('travel covers supported example modes without live claims', () => {
  const view = getTestDataView();
  expect(view.travel.map((row) => row.mode)).toEqual([
    'bus',
    'train',
    'car',
    'electric_car',
    'walk',
    'cycle',
  ]);
  expect(view.travelNotice).toContain('not live routes or timetables');
  expect(view.travel.every((row) => row.emissionsLabel.includes('CO₂'))).toBe(
    true,
  );
  expect(view.travel.every((row) => !('legs' in row) && !('id' in row))).toBe(
    true,
  );
});

test('repeated reads make no network requests and do not share mutable display data', () => {
  const fetch = jest.spyOn(globalThis, 'fetch');
  try {
    const first = getTestDataView();
    const before = JSON.stringify(first);
    const second = getTestDataView();
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.activity[0]).not.toBe(first.activity[0]);
    Reflect.set(first.summary, 'pointsLabel', 'changed by a caller');
    expect(JSON.stringify(getTestDataView())).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    fetch.mockRestore();
  }
});
