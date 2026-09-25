import { routeConfig } from './config.ts';
import { z } from 'zod';
import type {
  RouteOption,
  RouteResult,
} from '../../src/features/routes/routes.ts';
import {
  normalizeResponse,
  primaryMode,
  type PrimaryMode,
  type RouteEvidence,
} from './normalize.ts';

const location = z.union([
  z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
  z.strictObject({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
]);
export const routeInput = z.strictObject({
  origin: location,
  destination: location,
  modes: z
    .array(primaryMode)
    .min(1)
    .max(4)
    .refine((value) => new Set(value).size === value.length),
  extraMinutes: z.int().min(0).max(1440),
});
export type RouteInput = z.infer<typeof routeInput>;
export type Failure =
  | 'invalid_input'
  | 'live_not_configured'
  | 'busy'
  | 'budget_exhausted'
  | 'provider_error'
  | 'timeout'
  | 'response_too_large'
  | 'missing_data'
  | 'no_route';
type ModeOutcome = { mode: PrimaryMode } & (
  | { kind: 'available'; count: number }
  | { kind: 'unavailable'; reason: Failure }
);
export type ProviderResult =
  | { kind: 'unavailable'; reason: Failure; outcomes?: ModeOutcome[] }
  | {
      kind: 'routes';
      source: Extract<RouteResult, { kind: 'routes' }>['source'];
      routes: RouteOption[];
      outcomes: ModeOutcome[];
      evidence: RouteEvidence[];
      fetchedAt: string;
    };

const fieldMask = [
  'routes.distanceMeters',
  'routes.duration',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.transitDetails.transitLine.vehicle.type',
  'routes.polyline.encodedPolyline',
  'routes.legs.startLocation',
  'routes.legs.endLocation',
].join(',');
const maxBytes = 131072;
function waypoint(value: RouteInput['origin']) {
  return typeof value === 'string'
    ? { address: value }
    : { location: { latLng: value } };
}

export function createRouteProvider(env: Record<string, string | undefined>) {
  const config = routeConfig(env);
  let active = false;
  let totalCalls = 0;
  let windowStart = Date.now();
  let windowCalls = 0;

  async function request(input: RouteInput, mode: PrimaryMode) {
    if (config.kind === 'disabled')
      return { kind: 'unavailable', reason: 'live_not_configured' } as const;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.key,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify({
          origin: waypoint(input.origin),
          destination: waypoint(input.destination),
          travelMode: mode,
          computeAlternativeRoutes: false,
          regionCode: 'SG',
          units: 'METRIC',
          polylineQuality: 'HIGH_QUALITY',
          ...(mode === 'DRIVE' ? { routingPreference: 'TRAFFIC_UNAWARE' } : {}),
        }),
      });
      try {
        if (!response.ok)
          return { kind: 'unavailable', reason: 'provider_error' } as const;
        if (
          !/^application\/json(?:\s*;|$)/i.test(
            response.headers.get('content-type') ?? '',
          )
        )
          return { kind: 'unavailable', reason: 'missing_data' } as const;
        const length = response.headers.get('content-length');
        if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes))
          return { kind: 'unavailable', reason: 'response_too_large' } as const;
        if (!response.body)
          return { kind: 'unavailable', reason: 'missing_data' } as const;
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > maxBytes)
              return {
                kind: 'unavailable',
                reason: 'response_too_large',
              } as const;
            chunks.push(part.value);
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        const raw: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        // Keep the same deadline and active-request slot through CPU validation.
        return await normalizeResponse(mode, raw, controller.signal);
      } finally {
        await response.body?.cancel().catch(() => {});
      }
    } catch {
      return {
        kind: 'unavailable',
        reason: controller.signal.aborted ? 'timeout' : 'provider_error',
      } as const;
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    async search(raw: unknown): Promise<ProviderResult> {
      const parsed = routeInput.safeParse(raw);
      if (!parsed.success)
        return { kind: 'unavailable', reason: 'invalid_input' };
      if (config.kind === 'disabled')
        return { kind: 'unavailable', reason: 'live_not_configured' };
      if (active) return { kind: 'unavailable', reason: 'busy' };
      const input = parsed.data;
      if (Date.now() - windowStart >= 60000) {
        windowStart = Date.now();
        windowCalls = 0;
      }
      if (
        windowCalls + input.modes.length > 60 ||
        totalCalls + input.modes.length > 1000
      )
        return { kind: 'unavailable', reason: 'budget_exhausted' };
      // Reserve the complete operation before spending. No retries or waiting queue.
      windowCalls += input.modes.length;
      totalCalls += input.modes.length;
      active = true;
      try {
        const routes: RouteOption[] = [];
        const evidence: RouteEvidence[] = [];
        const outcomes: ModeOutcome[] = [];
        for (let i = 0; i < input.modes.length; i += 2) {
          const modes = input.modes.slice(i, i + 2);
          const results = await Promise.all(
            modes.map((mode) => request(input, mode)),
          );
          for (const [index, result] of results.entries()) {
            const mode = modes[index];
            if (result.kind === 'routes') {
              routes.push(...result.routes);
              evidence.push(...result.evidence);
              outcomes.push({
                mode,
                kind: 'available',
                count: result.routes.length,
              });
            } else
              outcomes.push({
                mode,
                kind: 'unavailable',
                reason:
                  result.reason === 'outside_fixture_coverage'
                    ? 'missing_data'
                    : result.reason,
              });
          }
        }
        if (routes.length === 0)
          return {
            kind: 'unavailable',
            reason: outcomes.every(
              (item) =>
                item.kind === 'unavailable' && item.reason === 'no_route',
            )
              ? 'no_route'
              : 'provider_error',
            outcomes,
          };
        return {
          kind: 'routes',
          routes,
          outcomes,
          evidence,
          fetchedAt: new Date().toISOString(),
          source:
            config.kind === 'fixture'
              ? {
                  kind: 'fixture',
                  label:
                    'Synthetic upstream HTTP fixture. Not live route data.',
                }
              : { kind: 'live', provider: 'Google Routes' },
        };
      } finally {
        active = false;
      }
    },
  };
}
