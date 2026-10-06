import { z } from 'zod';
import type { RouteEstimate } from '@amr/travel-domain/emissions';
import type { JevRank } from '../ai/jev-rank.ts';

const place = z.union([
  z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v)),
  z.strictObject({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
]);
export const transportScenario = z.enum([
  'normal',
  'train-delay',
  'train-cancelled',
  'bus-delay',
]);
export const transportMode = z.enum(['train', 'bus', 'transit', 'walk', 'car']);
export const departureInput = z.strictObject({
  stopId: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,40}$/),
  mode: z.enum(['train', 'bus']),
  at: z.string().datetime({ offset: true }),
  scenario: transportScenario.default('normal'),
});
export type DepartureInput = z.infer<typeof departureInput>;
export const planInput = z
  .strictObject({
    origin: place,
    destination: place,
    departAt: z.string().datetime({ offset: true }),
    arriveBy: z.string().datetime({ offset: true }).optional(),
    scenario: transportScenario.default('normal'),
    modes: z
      .array(transportMode)
      .min(1)
      .max(4)
      .refine((v) => new Set(v).size === v.length)
      .default(['train', 'bus', 'walk', 'car']),
    extraMinutes: z.int().min(0).max(1440).default(15),
  })
  .superRefine((value, ctx) => {
    if (
      value.arriveBy &&
      new Date(value.arriveBy).getTime() <= new Date(value.departAt).getTime()
    )
      ctx.addIssue({
        code: 'custom',
        path: ['arriveBy'],
        message: 'arriveBy must be after departAt.',
      });
  });
export type PlanInput = z.infer<typeof planInput>;
export type TransportMode = z.infer<typeof transportMode>;
export type TransportScenario = z.infer<typeof transportScenario>;
export type Source =
  | { kind: 'simulated'; label: string; dataFreshness: string }
  | { kind: 'osrm'; provider: 'OSRM'; dataFreshness: string }
  | { kind: 'live'; provider: string; dataFreshness: string };
export type TransportCoordinate = { latitude: number; longitude: number };
export type TransportLeg = {
  kind: 'walk' | 'ride' | 'wait' | 'transfer' | 'drive';
  mode: TransportMode;
  from: string;
  to: string;
  startsAt: string;
  endsAt: string;
  durationSeconds: number;
  description: string;
  instruction: string | null;
  fromCoordinate: TransportCoordinate | null;
  toCoordinate: TransportCoordinate | null;
  /** Decoded provider shape for this leg, if any. Draw as-is; never join shapes. */
  path: TransportCoordinate[] | null;
};
export type TransportRoute = {
  id: string;
  mode: TransportMode;
  source: Source;
  legs: TransportLeg[];
  durationSeconds: number;
  waitSeconds: number;
  transfers: number;
  arrivesAt: string;
  meetsDeadline: boolean;
  distanceMeters: number | null;
};
export type TransportDeparture = {
  route: string;
  direction: string;
  departsAt: string;
  arrivesAt: string;
  status: 'scheduled' | 'delayed' | 'cancelled';
};
export type TransportEstimate = {
  routeId: string;
  estimate: RouteEstimate;
  /**
   * straight_line: every motorized leg measured endpoint to endpoint.
   * apportioned: provider route total shared across motorized legs by
   * duration; assumes uniform speed, so faster legs read high and slower
   * legs read low. Road distance would read higher than either.
   */
  distanceMethod: 'straight_line' | 'apportioned';
};
export type DepartureResult = {
  stopId: string;
  mode: 'train' | 'bus';
  service: {
    kind: 'frequency';
    everyMinutes: 5;
    firstDeparture: string;
    lastDeparture: string;
  };
  source: Source;
  departures: TransportDeparture[];
};
export type PlanResult = {
  query: PlanInput;
  routes: TransportRoute[];
  unavailable: { mode: TransportMode; reason: string }[];
  estimates: TransportEstimate[];
  recommendation:
    | { kind: 'recommended'; routeId: string; reason: string }
    | { kind: 'unavailable'; reason: string };
  jev: JevRank;
  awardEligible: false;
  source: Source;
};
