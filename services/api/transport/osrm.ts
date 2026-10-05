import { z } from 'zod';
import type { RoadRouter } from './planner.ts';
import type { TransportRoute } from './contracts.ts';

const responseSchema = z.strictObject({
  code: z.literal('Ok'),
  routes: z
    .array(
      z.object({
        distance: z.number().finite().nonnegative().max(2_000_000),
        duration: z.number().finite().nonnegative().max(172_800),
        legs: z
          .array(
            z.object({
              steps: z
                .array(
                  z.object({
                    distance: z.number().finite().nonnegative().max(2_000_000),
                    duration: z.number().finite().nonnegative().max(172_800),
                    name: z.string().max(200),
                    maneuver: z.object({
                      instruction: z.string().max(500).optional(),
                      location: z.tuple([
                        z.number().finite(),
                        z.number().finite(),
                      ]),
                    }),
                  }),
                )
                .max(1000),
            }),
          )
          .max(10),
      }),
    )
    .min(1)
    .max(3),
});

export function createOsrmRouter(baseUrl: string): RoadRouter {
  const parsed = new URL(baseUrl);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !['http:', 'https:'].includes(parsed.protocol)
  )
    throw new Error('Invalid OSRM base URL.');
  return async (
    origin,
    destination,
    departAt,
    suppliedCoordinates,
  ): Promise<TransportRoute | null> => {
    const coordinates: Record<string, [number, number]> = {
      orchard: [103.8329, 1.3048],
      'dhoby-ghaut': [103.8455, 1.2988],
      'city-hall': [103.852, 1.2931],
      bayfront: [103.8602, 1.2816],
      'marina-bay': [103.8545, 1.2764],
      bugis: [103.8558, 1.3008],
    };
    const from = suppliedCoordinates
      ? [suppliedCoordinates.origin.longitude, suppliedCoordinates.origin.latitude] as [number, number]
      : coordinates[origin];
    const to = suppliedCoordinates
      ? [suppliedCoordinates.destination.longitude, suppliedCoordinates.destination.latitude] as [number, number]
      : coordinates[destination];
    if (!from || !to) return null;
    const url = new URL(
      `route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}`,
      `${parsed.toString().replace(/\/$/, '')}/`,
    );
    url.searchParams.set('overview', 'false');
    url.searchParams.set('steps', 'true');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(url, {
        redirect: 'error',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;
      const value = responseSchema.safeParse(await response.json());
      if (!value.success) return null;
      const route = value.data.routes[0];
      const endsAt = new Date(
        departAt.getTime() + route.duration * 1000,
      ).toISOString();
      const osrmSteps = route.legs.flatMap((item) => item.steps);
      let stepStart = departAt;
      const legs: TransportRoute['legs'] = [];
      for (const [index, step] of osrmSteps.entries()) {
        const fromCoordinate =
          index === 0
            ? { latitude: from[1], longitude: from[0] }
            : {
                latitude: osrmSteps[index - 1].maneuver.location[1],
                longitude: osrmSteps[index - 1].maneuver.location[0],
              };
        const toCoordinate =
          index === osrmSteps.length - 1
            ? { latitude: to[1], longitude: to[0] }
            : {
                latitude: step.maneuver.location[1],
                longitude: step.maneuver.location[0],
              };
        const durationSeconds = step.duration;
        const endsAtStep = new Date(
          stepStart.getTime() + durationSeconds * 1000,
        );
        legs.push({
          kind: 'drive',
          mode: 'car',
          from: index === 0 ? origin : 'road',
          to: index === osrmSteps.length - 1 ? destination : 'road',
          startsAt: stepStart.toISOString(),
          endsAt: endsAtStep.toISOString(),
          durationSeconds,
          description:
            step.maneuver.instruction ?? (step.name || 'Continue on the road'),
          instruction: step.maneuver.instruction ?? null,
          fromCoordinate,
          toCoordinate,
        });
        stepStart = endsAtStep;
      }
      if (legs.length === 0) {
        legs.push({
          kind: 'drive',
          mode: 'car',
          from: origin,
          to: destination,
          startsAt: departAt.toISOString(),
          endsAt,
          durationSeconds: route.duration,
          description: 'Drive using OpenStreetMap road data.',
          instruction: null,
          fromCoordinate: { latitude: from[1], longitude: from[0] },
          toCoordinate: { latitude: to[1], longitude: to[0] },
        });
      }
      return {
        id: 'osrm-car',
        mode: 'car',
        source: {
          kind: 'osrm',
          provider: 'OSRM',
          dataFreshness: new Date().toISOString(),
        },
        legs,
        durationSeconds: route.duration,
        waitSeconds: 0,
        transfers: 0,
        arrivesAt: endsAt,
        meetsDeadline: true,
        distanceMeters: route.distance,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}
