import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ApiError, type Identity } from '../accounts/types.ts';

export const SUPABASE_PROJECT_REF = 'folakoxsilrfemctvlxj';
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
export const SUPABASE_ISSUER = `${SUPABASE_URL}/auth/v1`;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Verify user identity only. Application roles always come from app.principals. */
export function createSupabaseVerifier(
  keys: JWTVerifyGetKey = createRemoteJWKSet(
    new URL(`${SUPABASE_ISSUER}/.well-known/jwks.json`),
    { timeoutDuration: 5000, cooldownDuration: 30000 },
  ),
) {
  return async (token: string): Promise<Identity> => {
    try {
      if (token.length > 16384) throw new Error();
      const { payload } = await jwtVerify(token, keys, {
        issuer: SUPABASE_ISSUER,
        audience: 'authenticated',
        algorithms: ['ES256'],
        requiredClaims: [
          'sub',
          'iat',
          'exp',
          'session_id',
          'role',
          'is_anonymous',
        ],
        maxTokenAge: '24h',
        clockTolerance: 0,
      });
      if (
        typeof payload.sub !== 'string' ||
        !uuid.test(payload.sub) ||
        typeof payload.session_id !== 'string' ||
        !uuid.test(payload.session_id) ||
        payload.aud !== 'authenticated' ||
        payload.role !== 'authenticated' ||
        payload.is_anonymous !== false ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number' ||
        !Number.isInteger(payload.iat) ||
        !Number.isInteger(payload.exp) ||
        payload.exp <= payload.iat ||
        payload.exp - payload.iat > 86400
      )
        throw new Error();
      return { issuer: SUPABASE_ISSUER, subject: payload.sub };
    } catch {
      throw new ApiError(401, 'Identity could not be verified.');
    }
  };
}
