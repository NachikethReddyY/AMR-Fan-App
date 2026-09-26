import { z } from 'zod';
import type {
  RouteLeg,
  RouteOption,
} from '../../src/features/routes/routes.ts';
import {
  coordinate,
  isSingaporeCoordinate,
  singaporeRouteGeography,
  type Coordinate,
} from './geography.ts';
import {
  decodePolyline,
  sameEndpoint,
  type PrimaryMode,
  type RouteEvidence,
} from './normalize.ts';

const missing = { kind: 'unavailable', reason: 'missing_data' } as const;
const meters = z.number().nonnegative().max(20_000_000);
const seconds = z.number().nonnegative().max(604800);
const polyline = z
  .string()
  .min(1)
  .max(24000)
  .regex(/^[?-~]+$/);
const place = z.object({
  lat: coordinate.shape.latitude,
  lon: coordinate.shape.longitude,
});
const at = (p: z.infer<typeof place>): Coordinate => ({
  latitude: p.lat,
  longitude: p.lon,
});
const roadResponse = z.object({
  error: z.never().optional(),
  status: z.literal(0),
  route_instructions: z.array(z.array(z.unknown()).max(12)).max(128),
  route_geometry: polyline,
  route_summary: z.object({
    total_time: seconds.positive(),
    total_distance: meters.positive(),
  }),
});
const leg = z.object({
  mode: z.enum(['WALK', 'BUS', 'SUBWAY']),
  transitLeg: z.boolean(),
  distance: meters,
  duration: seconds,
  startTime: z.int().nonnegative(),
  endTime: z.int().nonnegative(),
  from: place,
  to: place,
  legGeometry: z.object({ points: polyline, length: z.int().min(2).max(2048) }),
});
const ptResponse = z.object({
  error: z.never().optional(),
  plan: z.object({
    itineraries: z
      .array(
        z.object({
          duration: seconds.positive(),
          startTime: z.int().nonnegative(),
          endTime: z.int().nonnegative(),
          legs: z.array(leg).min(1).max(128),
        }),
      )
      .max(3),
  }),
});
const decimal = z
  .string()
  .max(30)
  .regex(/^-?\d+(?:\.\d+)?$/)
  .transform(Number);
const searchResponse = z.object({
  error: z.never().optional(),
  found: z.literal(1),
  totalNumPages: z.literal(1),
  pageNum: z.literal(1),
  results: z
    .array(
      z.object({
        LATITUDE: decimal.pipe(coordinate.shape.latitude),
        LONGITUDE: decimal.pipe(coordinate.shape.longitude),
      }),
    )
    .length(1),
});
export function resolveOneMapAddress(raw: unknown) {
  const parsed = searchResponse.safeParse(raw);
  if (!parsed.success) return missing;
  const result = {
    latitude: parsed.data.results[0].LATITUDE,
    longitude: parsed.data.results[0].LONGITUDE,
  };
  return isSingaporeCoordinate(result)
    ? ({ kind: 'coordinate', coordinate: result } as const)
    : missing;
}

export async function normalizeOneMap(
  mode: PrimaryMode,
  raw: unknown,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const candidates: {
    legs: RouteLeg[];
    duration: number;
    points: Coordinate[];
    continuous: boolean;
  }[] = [];
  if (mode === 'TRANSIT') {
    const parsed = ptResponse.safeParse(raw);
    if (!parsed.success) return missing;
    for (const route of parsed.data.plan.itineraries) {
      const points: Coordinate[] = [];
      const legs: RouteLeg[] = [];
      let previousEnd = route.startTime;
      let continuous = true;
      for (const item of route.legs) {
        const decoded = decodePolyline(item.legGeometry.points);
        if (
          !decoded ||
          decoded.length !== item.legGeometry.length ||
          !isSingaporeCoordinate(at(item.from)) ||
          !isSingaporeCoordinate(at(item.to)) ||
          item.startTime < previousEnd ||
          item.endTime < item.startTime ||
          Math.abs((item.endTime - item.startTime) / 1000 - item.duration) >
            1 ||
          item.transitLeg !== (item.mode !== 'WALK')
        )
          return missing;
        if ((await singaporeRouteGeography(decoded, signal)) !== 'Singapore')
          return missing;
        // OneMap stop coordinates and shapes can differ. Keep metrics, but the
        // existing single-polyline evidence cannot represent disconnected legs.
        continuous &&=
          sameEndpoint(decoded[0], at(item.from)) &&
          sameEndpoint(decoded[decoded.length - 1], at(item.to)) &&
          (points.length === 0 ||
            sameEndpoint(points[points.length - 1], decoded[0]));
        points.push(...decoded);
        if (points.length > 2048) return missing;
        previousEnd = item.endTime;
        const legMode =
          item.mode === 'WALK' ? 'walk' : item.mode === 'BUS' ? 'bus' : 'train';
        legs.push({
          mode: legMode,
          distanceMeters: item.distance,
          durationSeconds: item.duration,
          description:
            item.mode === 'WALK'
              ? 'Walk'
              : item.mode === 'BUS'
                ? 'Bus'
                : 'MRT/LRT',
        });
      }
      if (
        route.legs[0].startTime !== route.startTime ||
        previousEnd !== route.endTime ||
        Math.abs((route.endTime - route.startTime) / 1000 - route.duration) >
          1 ||
        legs.reduce((n, l) => n + l.durationSeconds, 0) >
          route.duration + legs.length
      )
        return missing;
      candidates.push({ legs, duration: route.duration, points, continuous });
    }
  } else {
    const parsed = roadResponse.safeParse(raw);
    if (!parsed.success) return missing;
    const points = decodePolyline(parsed.data.route_geometry);
    if (!points) return missing;
    const legMode =
      mode === 'DRIVE' ? 'car' : mode === 'BICYCLE' ? 'cycle' : 'walk';
    candidates.push({
      points,
      continuous: true,
      duration: parsed.data.route_summary.total_time,
      legs: [
        {
          mode: legMode,
          distanceMeters: parsed.data.route_summary.total_distance,
          durationSeconds: parsed.data.route_summary.total_time,
          description:
            mode === 'DRIVE' ? 'Drive' : mode === 'BICYCLE' ? 'Cycle' : 'Walk',
        },
      ],
    });
  }
  if (candidates.length === 0)
    return { kind: 'unavailable', reason: 'no_route' } as const;
  const routes: RouteOption[] = [];
  const evidence: RouteEvidence[] = [];
  for (const [i, c] of candidates.entries()) {
    const distance = c.legs.reduce((n, l) => n + l.distanceMeters, 0);
    if (
      distance <= 0 ||
      distance > 20_000_000 ||
      (c.continuous &&
        (await singaporeRouteGeography(c.points, signal)) !== 'Singapore')
    )
      return missing;
    const id = `onemap-${mode.toLowerCase()}-${i}`;
    const primary =
      c.legs.find((l) => l.mode === 'train')?.mode ??
      c.legs.find((l) => l.mode === 'bus')?.mode ??
      c.legs[0].mode;
    routes.push({
      id,
      mode: primary,
      availability: { kind: 'available' },
      legs: c.legs,
      distanceMeters: distance,
      durationSeconds: c.duration,
    });
    evidence.push({
      routeId: id,
      primaryMode: mode,
      geometry: c.continuous
        ? {
            kind: 'provider',
            start: c.points[0],
            end: c.points[c.points.length - 1],
            points: c.points,
            encoding: 'google-polyline5',
          }
        : { kind: 'unavailable', reason: 'missing_geometry' },
      factorApplicability: c.continuous
        ? 'singapore_indicative'
        : 'geography_unverified',
    });
  }
  signal?.throwIfAborted();
  return { kind: 'routes', routes, evidence } as const;
}
