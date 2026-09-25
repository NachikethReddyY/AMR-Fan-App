import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ApiError, type Identity } from '../accounts/types.ts';
import type { AuthConfig } from './config.ts';

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
      return { issuer: config.issuer, subject: payload.sub };
    } catch {
      // Never leak tokens, provider claims, JWKS URLs or library diagnostics.
      throw new ApiError(401, 'Identity could not be verified.');
    }
  };
}
