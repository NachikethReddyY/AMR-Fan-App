import { exampleActivity, exampleRewards, exampleTravel } from './fixtures';

type Row = Readonly<{ key: string; label: string; detail: string }>;

export type TestDataView = Readonly<{
  kind: 'test-data';
  label: 'Test data';
  notice: string;
  summary: Readonly<{ pointsLabel: string; impactLabel: string }>;
  activity: readonly (Row &
    Readonly<{ pointsLabel: string; balanceLabel: string }>)[];
  rewards: readonly (Row &
    Readonly<{
      kind: (typeof exampleRewards)[number]['kind'];
      priceLabel: string;
    }>)[];
  travelNotice: string;
  travel: readonly (Row &
    Readonly<{
      mode: (typeof exampleTravel)[number]['mode'];
      distanceLabel: string;
      durationLabel: string;
      emissionsLabel: string;
    }>)[];
}>;

const number = (value: number) => value.toLocaleString('en-GB');

/** Display data only. Deliberately accepts no account, API or profile context. */
export function getTestDataView(): TestDataView {
  let balance = 0;
  let reductionKg = 0;
  const activity = exampleActivity
    .map((entry) => {
      balance += entry.points;
      if (entry.kind === 'journey') reductionKg += entry.reductionKg;
      return {
        key: entry.key,
        label: `Example: ${entry.title}`,
        pointsLabel: `${entry.points > 0 ? '+' : ''}${number(entry.points)} example points`,
        balanceLabel: `Example balance: ${number(balance)} points`,
        detail:
          entry.kind === 'journey'
            ? `${entry.reductionKg} kg example CO₂ reduction. Fictional history, not verified travel or typical earnings.`
            : entry.detail,
      };
    })
    .reverse();
  return {
    kind: 'test-data',
    label: 'Test data',
    notice:
      'Examples only. No points, impact or rewards are added to your account. Prices are illustrative, not live offers or earning policy.',
    summary: {
      pointsLabel: `${number(balance)} example points`,
      impactLabel: `${number(reductionKg)} kg example CO₂ reduction`,
    },
    activity,
    rewards: exampleRewards.map((reward) => ({
      key: reward.key,
      kind: reward.kind,
      label: `Example: ${reward.title}`,
      priceLabel: `${number(reward.points)} example points`,
      detail: reward.detail,
    })),
    travelNotice:
      'Illustrative distances, times and CO₂ estimates, not live routes or timetables. Separate examples from the activity history; no journey can be started here.',
    travel: exampleTravel.map((route) => ({
      key: route.key,
      mode: route.mode,
      label: `Example: ${route.title}`,
      distanceLabel: `${number(route.distanceKm)} km example distance`,
      durationLabel: `${number(route.minutes)} min example duration`,
      emissionsLabel: `${number(route.emissionsKg)} kg example CO₂ emissions`,
      detail:
        'Illustrative comparison only. No live availability or provider data.',
    })),
  };
}
