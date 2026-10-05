import { isAbsolute } from 'node:path';
import { z } from 'zod';
const googleEndpoint =
  'https://routes.googleapis.com/directions/v2:computeRoutes';

export type RouteConfig =
  | { kind: 'disabled' }
  | {
      kind: 'onemap';
      baseUrl: string;
      timeoutMs: number;
      credentials:
        | { kind: 'fixture' }
        | { kind: 'file'; path: string }
        | { kind: 'token-file'; path: string; expires: number }
        | { kind: 'env-account'; email: string; password: string }
        | { kind: 'env-token'; value: string; expires: number };
    }
  | {
      kind: 'google' | 'fixture';
      endpoint: string;
      key: string;
      timeoutMs: number;
    };

export function routeConfig(
  env: Record<string, string | undefined>,
): RouteConfig {
  const invalid = () => new Error('Invalid route provider configuration.');
  const alias = (names: string[]) => {
    const values = names
      .map((name) => env[name])
      .filter((value): value is string => value !== undefined);
    if (new Set(values).size > 1) throw invalid();
    return values[0];
  };
  const selected =
    alias(['AMR_ROUTES_PROVIDER', 'ROUTES_PROVIDER', 'MAP_PROVIDER']) ??
    'google';
  if (!['disabled', 'google', 'onemap'].includes(selected)) throw invalid();
  if (selected === 'disabled') return { kind: 'disabled' };
  if (selected === 'onemap') {
    const timeout = env.AMR_ROUTES_TIMEOUT_MS ?? '3000';
    if (
      !/^\d+$/.test(timeout) ||
      Number(timeout) < 25 ||
      Number(timeout) > 5000
    )
      throw invalid();
    if (
      env.AMR_ROUTES_SYNTHETIC &&
      !['true', 'false'].includes(env.AMR_ROUTES_SYNTHETIC)
    )
      throw invalid();
    const fixture = env.AMR_ROUTES_SYNTHETIC === 'true';
    const baseUrl =
      alias(['AMR_ONEMAP_BASE_URL', 'ONEMAP_BASE_URL']) ??
      'https://www.onemap.gov.sg';
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw invalid();
    }
    if (fixture) {
      if (
        env.NODE_ENV !== 'test' ||
        url.protocol !== 'http:' ||
        url.hostname !== '127.0.0.1' ||
        !url.port ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        url.username ||
        url.password ||
        env.AMR_ONEMAP_CREDENTIALS_FILE ||
        env.AMR_ONEMAP_ACCESS_TOKEN_FILE ||
        env.AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT ||
        env.ONEMAP_CREDENTIALS_FILE ||
        env.ONEMAP_ACCESS_TOKEN_FILE ||
        env.ONEMAP_ACCESS_TOKEN_EXPIRES_AT ||
        env.AMR_ONEMAP_EMAIL ||
        env.ONEMAP_EMAIL ||
        env.ONEMAP_API_EMAIL ||
        env.AMR_ONEMAP_PASSWORD ||
        env.ONEMAP_PASSWORD ||
        env.ONEMAP_EMAIL_PASSWORD ||
        env.ONEMAP_API_PASSWORD ||
        env.AMR_ONEMAP_ACCESS_TOKEN ||
        env.ONEMAP_ACCESS_TOKEN ||
        env.ONEMAP_API_KEY ||
        env.ONEMAP_APIKKEY ||
        env.AMR_GOOGLE_ROUTES_KEY
      )
        throw invalid();
      return {
        kind: 'onemap',
        baseUrl: url.origin,
        timeoutMs: Number(timeout),
        credentials: { kind: 'fixture' },
      };
    }
    if (baseUrl !== 'https://www.onemap.gov.sg') throw invalid();
    const path = alias([
      'AMR_ONEMAP_CREDENTIALS_FILE',
      'ONEMAP_CREDENTIALS_FILE',
    ]);
    const tokenPath = alias([
      'AMR_ONEMAP_ACCESS_TOKEN_FILE',
      'ONEMAP_ACCESS_TOKEN_FILE',
    ]);
    const cutoff = alias([
      'AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT',
      'ONEMAP_ACCESS_TOKEN_EXPIRES_AT',
    ]);
    const email = alias([
      'AMR_ONEMAP_EMAIL',
      'ONEMAP_EMAIL',
      'ONEMAP_API_EMAIL',
    ]);
    const password = alias([
      'AMR_ONEMAP_PASSWORD',
      'ONEMAP_PASSWORD',
      'ONEMAP_EMAIL_PASSWORD',
      'ONEMAP_API_PASSWORD',
    ]);
    const accessToken = alias([
      'AMR_ONEMAP_ACCESS_TOKEN',
      'ONEMAP_ACCESS_TOKEN',
      'ONEMAP_API_KEY',
      // Keep the supplied spelling as a compatibility alias.
      'ONEMAP_APIKKEY',
    ]);
    if (accessToken !== undefined) {
      if (
        path ||
        tokenPath ||
        password !== undefined ||
        (email !== undefined && !z.email().max(254).safeParse(email).success) ||
        !/^[A-Za-z0-9._~-]{1,8192}$/.test(accessToken)
      )
        throw invalid();
      const expires = cutoff ? Date.parse(cutoff) : Date.now() + 3 * 86400000;
      if (
        cutoff &&
        (cutoff.length > 40 ||
          !z.iso.datetime({ offset: true }).safeParse(cutoff).success)
      )
        throw invalid();
      if (!Number.isFinite(expires) || expires <= Date.now() + 60000)
        throw invalid();
      return {
        kind: 'onemap',
        baseUrl,
        timeoutMs: Number(timeout),
        credentials: { kind: 'env-token', value: accessToken, expires },
      };
    }
    if (email !== undefined || password !== undefined) {
      if (
        path ||
        tokenPath ||
        cutoff ||
        (email === undefined) !== (password === undefined)
      )
        throw invalid();
      if (!email || !password || cutoff) throw invalid();
      if (
        !z.email().max(254).safeParse(email).success ||
        password.length > 1024
      )
        throw invalid();
      return {
        kind: 'onemap',
        baseUrl,
        timeoutMs: Number(timeout),
        credentials: { kind: 'env-account', email, password },
      };
    }
    if (tokenPath || cutoff) {
      if (
        path ||
        !tokenPath ||
        !isAbsolute(tokenPath) ||
        !cutoff ||
        cutoff.length > 40 ||
        !z.iso.datetime({ offset: true }).safeParse(cutoff).success ||
        !Number.isFinite(Date.parse(cutoff))
      )
        throw invalid();
      return {
        kind: 'onemap',
        baseUrl,
        timeoutMs: Number(timeout),
        credentials: {
          kind: 'token-file',
          path: tokenPath,
          expires: Date.parse(cutoff),
        },
      };
    }
    if (!path) return { kind: 'disabled' };
    if (!isAbsolute(path)) throw invalid();
    return {
      kind: 'onemap',
      baseUrl,
      timeoutMs: Number(timeout),
      credentials: { kind: 'file', path },
    };
  }
  const endpoint = env.AMR_GOOGLE_ROUTES_ENDPOINT ?? googleEndpoint;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw invalid();
  }
  const fixture = env.AMR_ROUTES_SYNTHETIC === 'true';
  if (
    env.AMR_ROUTES_SYNTHETIC &&
    !['true', 'false'].includes(env.AMR_ROUTES_SYNTHETIC)
  )
    throw invalid();
  if (url.username || url.password || url.search || url.hash) throw invalid();
  if (fixture) {
    if (
      env.NODE_ENV !== 'test' ||
      url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' ||
      !url.port ||
      url.pathname !== '/directions/v2:computeRoutes'
    )
      throw invalid();
  } else if (endpoint !== googleEndpoint) throw invalid();
  const timeout = env.AMR_ROUTES_TIMEOUT_MS ?? '3000';
  if (!/^\d+$/.test(timeout) || Number(timeout) < 25 || Number(timeout) > 5000)
    throw invalid();
  // Fixture credentials are fixed synthetic data. Never forward a real key to loopback.
  if (fixture) {
    if (env.AMR_GOOGLE_ROUTES_KEY) throw invalid();
    return {
      kind: 'fixture',
      endpoint,
      key: 'amr-synthetic-routes',
      timeoutMs: Number(timeout),
    };
  }
  const key = env.AMR_GOOGLE_ROUTES_KEY;
  if (!key) return { kind: 'disabled' };
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(key)) throw invalid();
  return { kind: 'google', endpoint, key, timeoutMs: Number(timeout) };
}
