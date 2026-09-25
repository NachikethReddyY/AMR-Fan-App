type Environment = Record<string, string | undefined>;
export type AuthConfig =
  | { kind: 'synthetic' }
  | {
      kind: 'oidc';
      issuer: string;
      audience: string;
      jwksUrl: string;
      scope: string;
    };

function httpsUrl(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required.`);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error(
      `${name} must be an HTTPS URL without credentials or fragment.`,
    );
  }
  return value;
}

export function authConfig(env: Environment = process.env): AuthConfig {
  if (!['production', 'development', 'test'].includes(env.NODE_ENV ?? '')) {
    throw new Error(
      'NODE_ENV must explicitly be production, development or test.',
    );
  }
  if (
    env.AUTH_DEV_ENABLED &&
    !['true', 'false'].includes(env.AUTH_DEV_ENABLED)
  ) {
    throw new Error('AUTH_DEV_ENABLED must be true or false.');
  }
  if (env.AUTH_DEV_ENABLED === 'true') {
    if (env.NODE_ENV === 'production' || env.API_HOST !== '127.0.0.1') {
      throw new Error(
        'Synthetic identity requires non-production and loopback API_HOST.',
      );
    }
    return { kind: 'synthetic' };
  }
  if (!env.AUTH_AUDIENCE?.trim() || !env.AUTH_REQUIRED_SCOPE?.trim()) {
    throw new Error('AUTH_AUDIENCE and AUTH_REQUIRED_SCOPE are required.');
  }
  return {
    kind: 'oidc',
    issuer: httpsUrl(env.AUTH_ISSUER, 'AUTH_ISSUER'),
    audience: env.AUTH_AUDIENCE,
    jwksUrl: httpsUrl(env.AUTH_JWKS_URL, 'AUTH_JWKS_URL'),
    scope: env.AUTH_REQUIRED_SCOPE,
  };
}
