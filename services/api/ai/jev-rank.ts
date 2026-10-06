import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { boundedTransport } from './transport.ts';
import type { Failure } from './contracts.ts';
import { prepareJevRouteChoice } from './jev-decisions.ts';
import { prepareTokenRouterJevRequest } from './tokenrouter-jev-request.ts';
import { decimal, savings, wholePoints } from '../awards/decimal.ts';
import { ACTIVE_CAP_MINUTES } from '@amr/travel-domain/recommendation';
import type { RouteQueryResult } from '../routes/query.ts';
import type {
  TransportEstimate,
  TransportRoute,
} from '../transport/contracts.ts';

const decisionsUrl = 'https://api.tokenrouter.com/api/alpha/decisions';
const configSchema = z.strictObject({
  JEV_RANK_ENABLED: z
    .union([
      z.boolean(),
      z.enum(['true', 'false']).transform((value) => value === 'true'),
    ])
    .default(false),
  JEV_API_KEY: z
    .string()
    .min(1)
    .max(1024)
    .regex(/^[\x21-\x7e]+$/)
    .optional(),
  JEV_DECISIONS_URL: z
    .string()
    .url()
    .max(2048)
    .default(decisionsUrl)
    .refine((value) => {
      if (value === decisionsUrl) return true;
      if (process.env.NODE_ENV === 'production') return false;
      try {
        const url = new URL(value);
        return url.protocol === 'http:' && url.hostname === '127.0.0.1';
      } catch {
        return false;
      }
    }, 'Jev decisions run against the documented endpoint, or a local loopback fixture outside production.'),
  jevTimeoutMs: z.int().min(1000).max(20000).default(8000),
});
export type JevRankConfig = z.infer<typeof configSchema>;

export type JevRank =
  | {
      kind: 'ranked';
      orderedRouteIds: string[];
      confidence: number | null;
    }
  | {
      kind: 'unavailable';
      reason:
        | 'disabled'
        | 'missing-metrics'
        | 'invalid-input'
        | 'request-too-large'
        | 'invalid-output'
        | 'timeout'
        | 'provider'
        | 'busy';
      fallback: 'deterministic';
    };

type UnavailableReason = Extract<JevRank, { kind: 'unavailable' }>['reason'];
const fail = (
  reason: UnavailableReason,
): Extract<JevRank, { kind: 'unavailable' }> => ({
  kind: 'unavailable',
  reason,
  fallback: 'deterministic',
});

/**
 * Builds the Jev choice snapshot from verified, same-gas estimates only,
 * mirroring the deterministic narrowing: unverified routes stay listed in
 * the app but never enter the choice set. Needs at least two ranked routes,
 * otherwise there is nothing to choose and no call is made.
 */
export function buildRouteRankSnapshot(response: {
  result: RouteQueryResult['result'];
  estimates: RouteQueryResult['estimates'];
  query: RouteQueryResult['query'];
}):
  | { kind: 'prepared'; snapshot: unknown }
  | { kind: 'unavailable'; reason: 'missing-metrics' } {
  if (response.result.kind !== 'routes')
    return { kind: 'unavailable', reason: 'missing-metrics' };
  // The same viability rule as the deterministic pick: a 50-minute walk is
  // listed, but it never enters the choice set.
  const routes = response.result.routes.filter(
    (route) =>
      route.availability.kind === 'available' &&
      ((route.mode !== 'walk' && route.mode !== 'cycle') ||
        (route.durationSeconds !== null &&
          route.durationSeconds <= ACTIVE_CAP_MINUTES * 60)),
  );
  if (routes.length === 0)
    return { kind: 'unavailable', reason: 'missing-metrics' };
  const kgById = new Map<string, number>();
  for (const route of routes) {
    const item = response.estimates.find((entry) => entry.routeId === route.id);
    if (!item || item.estimate.kind !== 'estimated') continue;
    kgById.set(route.id, item.estimate.kgCo2e);
  }
  const ranked = routes.filter((route) => kgById.has(route.id));
  if (ranked.length < 2)
    return { kind: 'unavailable', reason: 'missing-metrics' };
  const baseline = ranked
    .filter((route) => route.mode === 'car' && route.durationSeconds !== null)
    .sort(
      (a, b) =>
        (a.durationSeconds ?? Infinity) - (b.durationSeconds ?? Infinity) ||
        a.id.localeCompare(b.id),
    )[0];
  const baselineKg =
    baseline !== undefined ? kgById.get(baseline.id) : undefined;
  if (baseline === undefined || baselineKg === undefined)
    return { kind: 'unavailable', reason: 'missing-metrics' };
  const snapshotRoutes = [];
  for (const route of ranked) {
    if (route.durationSeconds === null || route.durationSeconds <= 0)
      return { kind: 'unavailable', reason: 'missing-metrics' };
    const kg = kgById.get(route.id);
    if (kg === undefined)
      return { kind: 'unavailable', reason: 'missing-metrics' };
    snapshotRoutes.push({
      id: route.id,
      durationSeconds: route.durationSeconds,
      kgCo2e: kg,
      points: wholePoints(savings(decimal(baselineKg), decimal(kg)), 50, 2000),
    });
  }
  return {
    kind: 'prepared',
    snapshot: {
      snapshotId: randomUUID(),
      extraMinutes: response.query.extraMinutes,
      routes: snapshotRoutes,
    },
  };
}

/** Snapshot input for transport-plan routes, which carry their own estimates. */
export function buildTransportRankSnapshot(args: {
  routes: readonly TransportRoute[];
  estimates: readonly TransportEstimate[];
  extraMinutes: number;
}):
  | { kind: 'prepared'; snapshot: unknown }
  | { kind: 'unavailable'; reason: 'missing-metrics' } {
  const viable = args.routes.filter(
    (route) =>
      route.meetsDeadline &&
      (route.mode !== 'walk' ||
        route.durationSeconds <= ACTIVE_CAP_MINUTES * 60),
  );
  const kgById = new Map<string, number>();
  for (const route of viable) {
    const item = args.estimates.find((entry) => entry.routeId === route.id);
    const kg =
      item?.estimate.kind === 'estimated'
        ? item.estimate.kgCo2e
        : item?.estimate.kind === 'estimated_co2'
          ? item.estimate.kg
          : null;
    if (kg === null) continue;
    kgById.set(route.id, kg);
  }
  const ranked = viable.filter((route) => kgById.has(route.id));
  if (ranked.length < 2)
    return { kind: 'unavailable', reason: 'missing-metrics' };
  const baseline = ranked
    .filter((route) => route.mode === 'car')
    .sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
  const baselineKg =
    baseline !== undefined ? kgById.get(baseline.id) : undefined;
  if (baseline === undefined || baselineKg === undefined)
    return { kind: 'unavailable', reason: 'missing-metrics' };
  return {
    kind: 'prepared',
    snapshot: {
      snapshotId: randomUUID(),
      extraMinutes: args.extraMinutes,
      routes: ranked.map((route) => ({
        id: route.id,
        durationSeconds: route.durationSeconds,
        kgCo2e: kgById.get(route.id) as number,
        points: wholePoints(
          savings(decimal(baselineKg), decimal(kgById.get(route.id) as number)),
          50,
          2000,
        ),
      })),
    },
  };
}

/** Explicit skip without traffic, for empty plans and unconfigured callers. */
export function skipJev(): Extract<JevRank, { kind: 'unavailable' }> {
  return fail('missing-metrics');
}

/** Shared dispatch: validated snapshot in, ranked order or fallback out. */
async function dispatchRank(
  rawConfig: unknown,
  built:
    | { kind: 'prepared'; snapshot: unknown }
    | { kind: 'unavailable'; reason: 'missing-metrics' },
): Promise<JevRank> {
  // Never strict-parse a whole process env; read only the Jev keys.
  // AI_API_KEY is the established TokenRouter alias: one provider, one key.
  if (
    rawConfig !== undefined &&
    (typeof rawConfig !== 'object' || Array.isArray(rawConfig))
  )
    return fail('invalid-input');
  const record = (rawConfig ?? {}) as Record<string, unknown>;
  const source = {
    JEV_RANK_ENABLED: record.JEV_RANK_ENABLED,
    JEV_API_KEY: record.JEV_API_KEY ?? record.AI_API_KEY,
    JEV_DECISIONS_URL: record.JEV_DECISIONS_URL,
    jevTimeoutMs: record.jevTimeoutMs,
  };
  const parsed = configSchema.safeParse(source);
  if (!parsed.success) return fail('invalid-input');
  const config = parsed.data;
  if (built.kind === 'unavailable') return fail('missing-metrics');
  const prepared = prepareJevRouteChoice(built.snapshot);
  if (prepared.kind === 'unavailable')
    return fail(
      prepared.reason === 'missing-metrics'
        ? 'missing-metrics'
        : 'invalid-input',
    );
  const request = prepareTokenRouterJevRequest(prepared);
  if (request.kind === 'unavailable') return fail('request-too-large');
  if (!config.JEV_RANK_ENABLED || !config.JEV_API_KEY) return fail('disabled');
  const post = boundedTransport(
    config.JEV_DECISIONS_URL,
    config.jevTimeoutMs,
    config.JEV_API_KEY,
    60000,
  );
  const wire = await post(request.body);
  if (!wire.ok) {
    const reason: Failure = wire.reason;
    if (reason === 'timeout' || reason === 'provider' || reason === 'busy')
      return fail(reason);
    return fail('invalid-output');
  }
  const read = prepared.read(wire.value);
  if (read.kind === 'unavailable') return fail('invalid-output');
  return {
    kind: 'ranked',
    orderedRouteIds: read.routes.map((route) => route.id),
    confidence: read.confidence,
  };
}

/** Server-side Jev ranking over route-query options. No model arithmetic. */
export async function rankRouteChoice(
  rawConfig: unknown,
  response: Omit<RouteQueryResult, 'jev' | 'paths'>,
): Promise<JevRank> {
  return dispatchRank(rawConfig, buildRouteRankSnapshot(response));
}

/** Server-side Jev ranking over transport-plan options. No model arithmetic. */
export async function rankTransportChoice(
  rawConfig: unknown,
  args: {
    routes: readonly TransportRoute[];
    estimates: readonly TransportEstimate[];
    extraMinutes: number;
  },
): Promise<JevRank> {
  return dispatchRank(rawConfig, buildTransportRankSnapshot(args));
}
