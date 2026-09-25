const googleEndpoint =
  'https://routes.googleapis.com/directions/v2:computeRoutes';

export type RouteConfig =
  | { kind: 'disabled' }
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
