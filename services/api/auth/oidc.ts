import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ApiError, type Identity } from '../accounts/types.ts';
import type { AuthConfig } from './config.ts';

const defaultAdminClientId = '616286cc-a22b-49a2-b5a3-27011fd615a1';

export function oidcBrowserConfig(
  config: Extract<AuthConfig, { kind: 'oidc' }>,
  clientId: string | undefined = defaultAdminClientId,
  redirectUri: string | undefined,
) {
  if (!redirectUri || !/^https:\/\//.test(redirectUri))
    return { mode: 'unavailable' } as const;
  const authority = config.issuer.replace(/\/v2\.0\/?$/, '');
  return {
    mode: 'oidc' as const,
    authority,
    clientId: clientId ?? defaultAdminClientId,
    redirectUri,
    scope: `api://${config.audience}/${config.scope}`,
  };
}

function displayNameClaim(payload: Record<string, unknown>) {
  const direct = typeof payload.name === 'string' ? payload.name : '';
  const parts = [payload.given_name, payload.family_name].filter(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0,
  );
  const value = direct.trim() || parts.join(' ').trim();
  if (!value || value.length > 80 || /[\u0000-\u001f\u007f]/u.test(value))
    return undefined;
  return value;
}

export function createIdentityVerifier(
  config: Extract<AuthConfig, { kind: 'oidc' }>,
  keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(config.jwksUrl), {
    timeoutDuration: 5000,
    cooldownDuration: 30000,
  }),
) {
  return async (token: string): Promise<Identity> => {
    try {
      if (token.length > 16384) throw new Error('Oversize credential.');
      const { payload } = await jwtVerify(token, keys, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'iat', 'exp'],
        maxTokenAge: '24h',
        clockTolerance: 0,
      });
      const scope =
        typeof payload.scp === 'string' ? payload.scp : payload.scope;
      if (
        typeof payload.sub !== 'string' ||
        !payload.sub.trim() ||
        payload.sub.length > 255 ||
        typeof scope !== 'string' ||
        !scope.split(' ').includes(config.scope)
      ) {
        throw new Error('Required subject or API scope missing.');
      }
      const identity = { issuer: config.issuer, subject: payload.sub };
      const displayName = displayNameClaim(payload);
      return displayName ? { ...identity, displayName } : identity;
    } catch {
      // Never leak tokens, provider claims, JWKS URLs or library diagnostics.
      throw new ApiError(401, 'Identity could not be verified.');
    }
  };
}
