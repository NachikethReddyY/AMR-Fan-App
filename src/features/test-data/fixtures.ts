import type { Offer } from '../rewards/contracts';
import type { RouteMode } from '../routes/routes';

// Fictional display examples, never account transactions or earning evidence.
type ExampleActivity = Readonly<
  { key: string; title: string; points: number } & (
    | { kind: 'journey'; reductionKg: number }
    | { kind: 'content'; detail: string }
  )
>;

export const exampleActivity: readonly ExampleActivity[] = [
  {
    key: 'example-train-trip',
    kind: 'journey',
    title: 'Train journey',
    points: 600,
    reductionKg: 12,
  },
  {
    key: 'example-bus-trip',
    kind: 'journey',
    title: 'Bus journey',
    points: 500,
    reductionKg: 10,
  },
  {
    key: 'example-cycle-trip',
    kind: 'journey',
    title: 'Cycle journey',
    points: 400,
    reductionKg: 8,
  },
  {
    key: 'example-content-spend',
    kind: 'content',
    title: 'Content redemption',
    points: -250,
    detail: 'Illustrative spend only. No content is unlocked.',
  },
];

type ExampleReward = Readonly<{
  key: string;
  kind: Offer['product']['kind'];
  title: string;
  points: number;
  detail: string;
}>;

export const exampleRewards: readonly ExampleReward[] = [
  {
    key: 'example-content',
    kind: 'content',
    title: 'Behind-the-scenes story',
    points: 250,
    detail: 'Example content reward. No content is unlocked.',
  },
  {
    key: 'example-tree',
    kind: 'tree',
    title: 'Tree programme participation',
    points: 1000,
    detail:
      'Example participation reward. No tree is allocated or planted; no carbon removal is claimed.',
  },
  {
    key: 'example-discount',
    kind: 'discount',
    title: '10% store discount',
    points: 500,
    detail: 'Example discount reward. No voucher or official offer is issued.',
  },
];

type ExampleTravel = Readonly<{
  key: string;
  mode: Exclude<RouteMode, 'cab'>;
  title: string;
  distanceKm: number;
  minutes: number;
  emissionsKg: number;
}>;

// One fictional comparison, separate from the journeys in exampleActivity.
// These values are not a route provider response or an emissions calculation.
export const exampleTravel: readonly ExampleTravel[] = [
  {
    key: 'example-bus',
    mode: 'bus',
    title: 'Bus',
    distanceKm: 6.9,
    minutes: 36,
    emissionsKg: 0.5,
  },
  {
    key: 'example-train',
    mode: 'train',
    title: 'Train',
    distanceKm: 6.9,
    minutes: 33,
    emissionsKg: 0.2,
  },
  {
    key: 'example-car',
    mode: 'car',
    title: 'Car',
    distanceKm: 7.8,
    minutes: 19,
    emissionsKg: 1.4,
  },
  {
    key: 'example-electric-car',
    mode: 'electric_car',
    title: 'Electric car',
    distanceKm: 7.8,
    minutes: 19,
    emissionsKg: 0.6,
  },
  {
    key: 'example-walk',
    mode: 'walk',
    title: 'Walk',
    distanceKm: 6.4,
    minutes: 80,
    emissionsKg: 0,
  },
  {
    key: 'example-cycle',
    mode: 'cycle',
    title: 'Cycle',
    distanceKm: 6.4,
    minutes: 25,
    emissionsKg: 0,
  },
];
