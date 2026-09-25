import { z } from 'zod';
import { normalizeGoogleRoutes } from '../../src/features/routes/googleRoutes.ts';
import {
  coordinate,
  hasDistinctPoints,
  singaporeRouteGeography,
  type Coordinate,
} from './geography.ts';

export const primaryMode = z.enum(['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE']);
export type PrimaryMode = z.infer<typeof primaryMode>;
const distance = z.int().min(0).max(20_000_000);
const duration = z
  .string()
  .max(24)
  .regex(/^\d+(?:\.\d{1,9})?s$/)
  .refine((value) => Number(value.slice(0, -1)) <= 604800);
const step = z.strictObject({
  distanceMeters: distance,
  staticDuration: duration,
  travelMode: primaryMode,
  transitDetails: z
    .strictObject({
      transitLine: z.strictObject({
        vehicle: z.strictObject({ type: z.string().max(40) }),
      }),
    })
    .optional(),
});
const response = z.strictObject({
  // Protobuf JSON may omit an empty repeated field.
  routes: z
    .array(
      z.strictObject({
        distanceMeters: distance.positive(),
        duration,
        polyline: z
          .strictObject({
            encodedPolyline: z
              .string()
              .min(1)
              .max(24000)
              .regex(/^[?-~]+$/),
          })
          .optional(),
        legs: z
          .array(
            z.strictObject({
              startLocation: z.strictObject({ latLng: coordinate }).optional(),
              endLocation: z.strictObject({ latLng: coordinate }).optional(),
              steps: z.array(step).min(1).max(128),
            }),
          )
          .length(1),
      }),
    )
    .max(3)
    .optional(),
});
const parserMode = {
  DRIVE: 'car',
  TRANSIT: 'train',
  WALK: 'walk',
  BICYCLE: 'cycle',
} as const;

export type RouteEvidence = {
  routeId: string;
  primaryMode: PrimaryMode;
  geometry:
    | { kind: 'unavailable'; reason: 'missing_geometry' }
    | {
        kind: 'provider';
        start: Coordinate;
        end: Coordinate;
        points: Coordinate[];
        encoding: 'google-polyline5';
      };
  factorApplicability:
    | 'singapore_indicative'
    | 'geography_unverified'
    | 'unsupported_transit_factor';
};

function decodePolyline(encoded: string): Coordinate[] | null {
  const values: number[] = [];
  let value = 0,
    shift = 0;
  for (const character of encoded) {
    const byte = character.charCodeAt(0) - 63;
    value += (byte & 31) * 2 ** shift;
    if (byte < 32) {
      values.push(value % 2 === 1 ? -(value + 1) / 2 : value / 2);
      value = 0;
      shift = 0;
      if (values.length > 4096) return null;
    } else {
      shift += 5;
      if (shift > 30) return null;
    }
  }
  if (shift !== 0 || values.length < 4 || values.length % 2 !== 0) return null;
  const points: Coordinate[] = [];
  let latitude = 0,
    longitude = 0;
  for (let i = 0; i < values.length; i += 2) {
    latitude += values[i] / 1e5;
    longitude += values[i + 1] / 1e5;
    const parsed = coordinate.safeParse({ latitude, longitude });
    if (!parsed.success) return null;
    points.push(parsed.data);
  }
  return hasDistinctPoints(points) ? points : null;
}
function sameEndpoint(a: Coordinate, b: Coordinate) {
  // Two polyline5 quantization units; this is parser consistency, not journey adherence.
  return (
    Math.abs(a.latitude - b.latitude) <= 0.00002 &&
    Math.abs(a.longitude - b.longitude) <= 0.00002
  );
}

export async function normalizeResponse(
  mode: PrimaryMode,
  raw: unknown,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const parsed = response.safeParse(raw);
  if (!parsed.success)
    return { kind: 'unavailable', reason: 'missing_data' } as const;
  const routes = parsed.data.routes ?? [];
  const evidence: RouteEvidence[] = [];
  for (const [index, route] of routes.entries()) {
    const steps = route.legs.flatMap((leg) => leg.steps);
    const meters = steps.reduce((sum, item) => sum + item.distanceMeters, 0);
    const seconds = steps.reduce(
      (sum, item) => sum + Number(item.staticDuration.slice(0, -1)),
      0,
    );
    // Allow independent metre/second rounding, and transit waiting time. Do not
    // accept totals incompatible with the steps used for emissions arithmetic.
    if (
      meters <= 0 ||
      Number(route.duration.slice(0, -1)) <= 0 ||
      Math.abs(meters - route.distanceMeters) > steps.length ||
      seconds > Number(route.duration.slice(0, -1)) + steps.length ||
      (mode !== 'TRANSIT' &&
        Math.abs(seconds - Number(route.duration.slice(0, -1))) >
          steps.length) ||
      steps.some(
        (item) =>
          item.travelMode !== 'TRANSIT' && item.transitDetails !== undefined,
      )
    ) {
      return { kind: 'unavailable', reason: 'missing_data' } as const;
    }
    const start = route.legs[0].startLocation?.latLng,
      end = route.legs[0].endLocation?.latLng;
    const points = route.polyline
      ? decodePolyline(route.polyline.encodedPolyline)
      : null;
    if (
      route.polyline &&
      (!points ||
        (start && !sameEndpoint(start, points[0])) ||
        (end && !sameEndpoint(end, points[points.length - 1])))
    )
      return { kind: 'unavailable', reason: 'missing_data' } as const;
    const geometry: RouteEvidence['geometry'] =
      points && start && end
        ? { kind: 'provider', start, end, points, encoding: 'google-polyline5' }
        : { kind: 'unavailable', reason: 'missing_geometry' };
    const geography =
      geometry.kind === 'provider'
        ? await singaporeRouteGeography(
            [geometry.start, ...geometry.points, geometry.end],
            signal,
          )
        : null;
    const compatibleTransit = steps.every(
      (item) =>
        item.travelMode !== 'TRANSIT' ||
        ['BUS', 'SUBWAY', 'METRO_RAIL'].includes(
          item.transitDetails?.transitLine.vehicle.type ?? '',
        ),
    );
    evidence.push({
      routeId: `google-${parserMode[mode]}-${index}`,
      primaryMode: mode,
      geometry,
      factorApplicability:
        geography !== 'Singapore'
          ? 'geography_unverified'
          : compatibleTransit
            ? 'singapore_indicative'
            : 'unsupported_transit_factor',
    });
  }
  const normalized = normalizeGoogleRoutes(parserMode[mode], { routes });
  return normalized.kind === 'routes'
    ? { ...normalized, evidence }
    : normalized;
}
