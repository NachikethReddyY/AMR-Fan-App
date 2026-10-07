import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { RouteConfig } from './config.ts';
import {
  routeInput,
  type RouteInput,
  type ProviderResult,
  type Failure,
} from './provider.ts';
import { isSingaporeCoordinate, type Coordinate } from './geography.ts';
import { normalizeOneMap, searchOneMapAddresses } from './onemap-normalize.ts';
import type { PrimaryMode } from './normalize.ts';

type Config = Extract<RouteConfig, { kind: 'onemap' }>;
const credentialsSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(1).max(1024),
});
const accountAliasSchemas = [
  z.strictObject({
    ONEMAP_EMAIL: z.email().max(254),
    ONEMAP_EMAIL_PASSWORD: z.string().min(1).max(1024),
  }),
  z.strictObject({
    ONEMAP_EMAIL: z.email().max(254),
    ONEMAP_PASSWORD: z.string().min(1).max(1024),
  }),
  z.strictObject({
    ONEMAP_API_EMAIL: z.email().max(254),
    ONEMAP_API_PASSWORD: z.string().min(1).max(1024),
  }),
];
const tokenAliasSchemas = [
  z.strictObject({
    ONEMAP_EMAIL: z.email().max(254),
    ONEMAP_API_KEY: z
      .string()
      .min(1)
      .max(8192)
      .regex(/^[A-Za-z0-9._~-]+$/),
  }),
  z.strictObject({
    ONEMAP_EMAIL: z.email().max(254),
    ONEMAP_APIKKEY: z
      .string()
      .min(1)
      .max(8192)
      .regex(/^[A-Za-z0-9._~-]+$/),
  }),
];
type OneMapFileCredentials =
  | { email: string; password: string }
  | { kind: 'token'; value: string; expires: number };
const tokenSchema = z.object({
  access_token: z
    .string()
    .min(1)
    .max(8192)
    .regex(/^[A-Za-z0-9._~-]+$/),
  expiry_timestamp: z
    .string()
    .regex(/^\d{1,12}$/)
    .transform(Number),
});
const unavailable = (reason: Failure) =>
  ({ kind: 'unavailable', reason }) as const;
class ProviderFailure extends Error {
  reason: Failure;
  constructor(reason: Failure) {
    super('OneMap unavailable.');
    this.reason = reason;
  }
}

// Only the explicitly assigned private file is read, lazily, when a query needs a token.
async function readPrivateFile(path: string, maxBytes: number) {
  const root = await realpath(fileURLToPath(new URL('../..', import.meta.url)));
  const parent = await realpath(dirname(path));
  const location = relative(root, parent);
  if (
    !location ||
    (location !== '..' && !location.startsWith('../') && !isAbsolute(location))
  )
    throw new ProviderFailure('live_not_configured');
  const file = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = await file.stat();
    if (
      !stat.isFile() ||
      (stat.mode & 0o777) !== 0o600 ||
      stat.uid !== process.getuid?.() ||
      stat.size > maxBytes ||
      stat.nlink !== 1
    )
      throw new ProviderFailure('live_not_configured');
    const buffer = Buffer.alloc(maxBytes + 1);
    try {
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      if (bytesRead > maxBytes)
        throw new ProviderFailure('live_not_configured');
      return buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      buffer.fill(0);
    }
  } finally {
    await file.close();
  }
}

export async function readOneMapCredentials(
  path: string,
): Promise<OneMapFileCredentials> {
  const raw: unknown = JSON.parse(await readPrivateFile(path, 16384));
  const parsed = credentialsSchema.safeParse(raw);
  if (parsed.success)
    return { email: parsed.data.email, password: parsed.data.password };
  for (const schema of accountAliasSchemas) {
    const alias = schema.safeParse(raw);
    if (alias.success) {
      const value = alias.data as Record<string, string>;
      return {
        email: value.ONEMAP_EMAIL ?? value.ONEMAP_API_EMAIL,
        password:
          value.ONEMAP_EMAIL_PASSWORD ??
          value.ONEMAP_PASSWORD ??
          value.ONEMAP_API_PASSWORD,
      };
    }
  }
  for (const schema of tokenAliasSchemas) {
    const alias = schema.safeParse(raw);
    if (alias.success) {
      const value = alias.data as Record<string, string>;
      return {
        kind: 'token',
        value: value.ONEMAP_API_KEY ?? value.ONEMAP_APIKKEY,
        expires: Date.now() + 3 * 86400000,
      };
    }
  }
  throw new ProviderFailure('live_not_configured');
}

/** Process-local ceilings. Operators raise them for local/demo hosts where
 * repeated planning is normal; the defaults keep the committed behaviour. */
function readCallLimits(env: Record<string, string | undefined>) {
  const read = (name: string, fallback: number) => {
    const raw = env[name];
    if (raw === undefined) return fallback;
    if (!/^\d+$/.test(raw))
      throw new Error('Invalid route provider configuration.');
    const value = Number(raw);
    if (value < 1 || value > 1_000_000)
      throw new Error('Invalid route provider configuration.');
    return value;
  };
  return {
    window: read('AMR_ONEMAP_WINDOW_CALLS', 60),
    total: read('AMR_ONEMAP_TOTAL_CALLS', 1000),
  };
}

export function createOneMapProvider(
  config: Config,
  env: Record<string, string | undefined> = {},
) {
  const limits = readCallLimits(env);
  let active = false,
    total = 0,
    windowCalls = 0,
    windowStart = Date.now();
  let token: { value: string; expires: number } | null =
    config.credentials.kind === 'env-token'
      ? { value: config.credentials.value, expires: config.credentials.expires }
      : null;
  let tokenFileFailure: Failure | null = null;
  let refreshAfter = 0;
  function checkTokenFile() {
    if (config.credentials.kind !== 'token-file') return;
    if (Date.now() >= config.credentials.expires - 60000) {
      tokenFileFailure ??= 'live_not_configured';
      token = null;
    }
    if (tokenFileFailure) throw new ProviderFailure(tokenFileFailure);
  }
  async function bounded<T>(
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      return await run(controller.signal);
    } catch (error) {
      if (controller.signal.aborted) throw new ProviderFailure('timeout');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async function json(
    path: string,
    signal: AbortSignal,
    auth?: string,
    body?: unknown,
  ): Promise<unknown> {
    // Recheck every dispatch, including address lookups and later mode batches.
    checkTokenFile();
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'error',
      signal,
      headers: {
        ...(auth ? { Authorization: auth } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    try {
      if (response.status === 401 || response.status === 403) {
        token = null;
        if (config.credentials.kind === 'token-file')
          tokenFileFailure = 'provider_error';
        refreshAfter = Date.now() + 60000;
        throw new ProviderFailure('provider_error');
      }
      if (!response.ok)
        throw new ProviderFailure(
          response.status === 404 &&
            path.startsWith('/api/public/routingsvc/route?')
            ? 'no_route'
            : 'provider_error',
        );
      if (
        !/^application\/json(?:\s*;|$)/i.test(
          response.headers.get('content-type') ?? '',
        )
      )
        throw new ProviderFailure('missing_data');
      const length = response.headers.get('content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) > 131072))
        throw new ProviderFailure('response_too_large');
      if (!response.body) throw new ProviderFailure('missing_data');
      const reader = response.body.getReader();
      let bytes = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 131072) throw new ProviderFailure('response_too_large');
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const raw: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      return raw;
    } finally {
      await response.body?.cancel().catch(() => {});
    }
  }
  async function getToken() {
    const credentials = config.credentials;
    if (credentials.kind === 'env-account') {
      if (token && Date.now() < token.expires - 60000) return token.value;
      if (Date.now() < refreshAfter)
        throw new ProviderFailure('provider_error');
      refreshAfter = Date.now() + 60000;
      const raw = await bounded((signal) =>
        json('/api/auth/post/getToken', signal, undefined, {
          email: credentials.email,
          password: credentials.password,
        }),
      );
      const parsed = tokenSchema.safeParse(raw);
      if (
        !parsed.success ||
        parsed.data.expiry_timestamp * 1000 <= Date.now() + 60000
      )
        throw new ProviderFailure('missing_data');
      token = {
        value: parsed.data.access_token,
        expires: Math.min(
          parsed.data.expiry_timestamp * 1000,
          Date.now() + 3 * 86400000,
        ),
      };
      return token.value;
    }
    if (credentials.kind === 'env-token') {
      checkTokenFile();
      if (!token || Date.now() >= token.expires - 60000)
        throw new ProviderFailure('live_not_configured');
      return token.value;
    }
    if (credentials.kind === 'token-file') {
      checkTokenFile();
      if (!token) {
        try {
          const raw = await readPrivateFile(credentials.path, 8194);
          const parsed = tokenSchema.shape.access_token.safeParse(
            raw.replace(/\r?\n$/, ''),
          );
          if (!parsed.success) throw new ProviderFailure('live_not_configured');
          token = { value: parsed.data, expires: credentials.expires };
        } catch {
          tokenFileFailure = 'live_not_configured';
          throw new ProviderFailure(tokenFileFailure);
        }
        checkTokenFile();
      }
      return token.value;
    }
    if (token && Date.now() < token.expires - 60000) return token.value;
    if (Date.now() < refreshAfter) throw new ProviderFailure('provider_error');
    // No immediate retry. Even malformed/short-lived tokens cannot create a refresh storm.
    refreshAfter = Date.now() + 60000;
    let accountCredentials: z.infer<typeof credentialsSchema>;
    try {
      const fileCredentials =
        credentials.kind === 'fixture'
          ? {
              email: 'synthetic@example.invalid',
              password: 'amr-synthetic-onemap',
            }
          : await readOneMapCredentials(credentials.path);
      if ('kind' in fileCredentials) {
        token = fileCredentials;
        return fileCredentials.value;
      }
      accountCredentials = fileCredentials;
    } catch {
      throw new ProviderFailure('live_not_configured');
    }
    const raw = await bounded((signal) =>
      json('/api/auth/post/getToken', signal, undefined, accountCredentials),
    );
    const parsed = tokenSchema.safeParse(raw);
    if (
      !parsed.success ||
      parsed.data.expiry_timestamp * 1000 <= Date.now() + 60000
    )
      throw new ProviderFailure('missing_data');
    // Cache only in memory, never beyond the supplied expiry or documented three days.
    token = {
      value: parsed.data.access_token,
      expires: Math.min(
        parsed.data.expiry_timestamp * 1000,
        Date.now() + 3 * 86400000,
      ),
    };
    return token.value;
  }
  async function resolve(
    value: RouteInput['origin'],
    auth: string,
  ): Promise<Coordinate> {
    if (typeof value !== 'string') return value;
    const params = new URLSearchParams({
      searchVal: value,
      returnGeom: 'Y',
      getAddrDetails: 'Y',
      pageNum: '1',
    });
    const raw = await bounded((signal) =>
      json(`/api/common/elastic/search?${params}`, signal, auth),
    );
    if (
      raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as { results?: unknown }).results) &&
      (raw as { results: unknown[] }).results.length === 1 &&
      (raw as { found?: unknown }).found !== 1
    )
      throw new ProviderFailure('missing_data');
    const parsed = searchOneMapAddresses(raw);
    if (parsed.kind === 'unavailable') throw new ProviderFailure(parsed.reason);
    return parsed.places[0]!.coordinate;
  }
  function reason(error: unknown): Failure {
    return error instanceof ProviderFailure ? error.reason : 'provider_error';
  }
  return {
    async searchPlaces(query: string) {
      if (!/\S/.test(query) || query.trim().length > 120)
        return unavailable('invalid_input');
      if (active) return unavailable('busy');
      if (Date.now() - windowStart >= 60000) {
        windowStart = Date.now();
        windowCalls = 0;
      }
      const calls = 2;
      if (windowCalls + calls > limits.window || total + calls > limits.total)
        return unavailable('budget_exhausted');
      windowCalls += calls;
      total += calls;
      active = true;
      try {
        const auth = await getToken();
        const params = new URLSearchParams({
          searchVal: query.trim(),
          returnGeom: 'Y',
          getAddrDetails: 'Y',
          pageNum: '1',
        });
        const raw = await bounded((signal) =>
          json(`/api/common/elastic/search?${params}`, signal, auth),
        );
        const result = searchOneMapAddresses(raw);
        if (result.kind === 'unavailable') return result;
        return {
          ...result,
          source:
            config.credentials.kind === 'fixture'
              ? {
                  kind: 'fixture' as const,
                  label: 'Synthetic OneMap HTTP fixture. Not live place data.',
                }
              : {
                  kind: 'live' as const,
                  provider: 'OneMap / Singapore Land Authority',
                },
        };
      } catch (error) {
        return unavailable(reason(error));
      } finally {
        active = false;
      }
    },
    async search(raw: unknown): Promise<ProviderResult> {
      const parsed = routeInput.safeParse(raw);
      if (!parsed.success) return unavailable('invalid_input');
      const input = parsed.data;
      if (
        [input.origin, input.destination].some(
          (p) => typeof p !== 'string' && !isSingaporeCoordinate(p),
        )
      )
        return unavailable('invalid_input');
      if (active) return unavailable('busy');
      if (Date.now() - windowStart >= 60000) {
        windowStart = Date.now();
        windowCalls = 0;
      }
      // Reserve the worst case, including one auth call and up to two address searches.
      const calls =
        input.modes.length +
        1 +
        Number(typeof input.origin === 'string') +
        Number(typeof input.destination === 'string');
      if (windowCalls + calls > limits.window || total + calls > limits.total)
        return unavailable('budget_exhausted');
      windowCalls += calls;
      total += calls;
      active = true;
      try {
        const auth = await getToken();
        const origin = await resolve(input.origin, auth);
        const destination =
          typeof input.origin === 'string' && input.origin === input.destination
            ? origin
            : await resolve(input.destination, auth);
        const departure = new Date(Date.now() + 8 * 3600000).toISOString();
        const date = `${departure.slice(5, 7)}-${departure.slice(8, 10)}-${departure.slice(0, 4)}`;
        const types = {
          DRIVE: 'drive',
          WALK: 'walk',
          BICYCLE: 'cycle',
          TRANSIT: 'pt',
        } as const;
        const routes: Extract<ProviderResult, { kind: 'routes' }>['routes'] =
          [];
        const evidence: Extract<
          ProviderResult,
          { kind: 'routes' }
        >['evidence'] = [];
        const outcomes: NonNullable<
          Extract<ProviderResult, { kind: 'unavailable' }>['outcomes']
        > = [];
        async function request(mode: PrimaryMode) {
          const params = new URLSearchParams({
            start: `${origin.latitude},${origin.longitude}`,
            end: `${destination.latitude},${destination.longitude}`,
            routeType: types[mode],
            ...(mode === 'TRANSIT'
              ? {
                  date,
                  time: departure.slice(11, 19),
                  mode: 'TRANSIT',
                  numItineraries: '3',
                }
              : {}),
          });
          try {
            return await bounded(async (signal) =>
              normalizeOneMap(
                mode,
                await json(
                  `/api/public/routingsvc/route?${params}`,
                  signal,
                  auth,
                ),
                signal,
              ),
            );
          } catch (error) {
            return unavailable(reason(error));
          }
        }
        for (let i = 0; i < input.modes.length; i += 2) {
          const modes = input.modes.slice(i, i + 2);
          const results = await Promise.all(modes.map(request));
          for (const [j, result] of results.entries()) {
            if (result.kind === 'routes') {
              routes.push(...result.routes);
              evidence.push(...result.evidence);
              outcomes.push({
                mode: modes[j],
                kind: 'available',
                count: result.routes.length,
              });
            } else outcomes.push({ mode: modes[j], ...result });
          }
        }
        if (!routes.length)
          return {
            ...unavailable(
              outcomes.every(
                (o) => o.kind === 'unavailable' && o.reason === 'no_route',
              )
                ? 'no_route'
                : 'provider_error',
            ),
            outcomes,
          };
        return {
          kind: 'routes',
          routes,
          evidence,
          outcomes,
          fetchedAt: new Date().toISOString(),
          source:
            config.credentials.kind === 'fixture'
              ? {
                  kind: 'fixture',
                  label: 'Synthetic OneMap HTTP fixture. Not live route data.',
                }
              : { kind: 'live', provider: 'OneMap / Singapore Land Authority' },
        };
      } catch (error) {
        return unavailable(reason(error));
      } finally {
        active = false;
      }
    },
  };
}
