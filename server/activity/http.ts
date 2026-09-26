import type { IncomingMessage } from 'node:http';
import type { Pool } from 'pg';
import { z } from 'zod';
import { authenticateSession } from '../auth/session.ts';
import { readOwnedProfile } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';

const unavailable = { kind: 'unavailable', creditedPoints: 0 } as const;

/** Disabled at the HTTP boundary: no body parsing, image decode, provider or claim writer. */
export function createPhotoHandler(pool: Pool) {
  return async (req: IncomingMessage, path: string) => {
    const match =
      /^\/v1\/profiles\/([^/]+)\/activity\/(availability|photos)$/.exec(path);
    if (!match) return null;
    const id = z.uuid().safeParse(match[1]);
    if (!id.success) throw new ApiError(400, 'Invalid profile.');
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ') || header.length > 16400)
      throw new ApiError(401, 'Sign in again.');
    const actor = await authenticateSession(pool, header.slice(7));
    const profile = await readOwnedProfile(pool, actor.principalId, id.data);
    if (profile.kind !== 'real')
      throw new ApiError(409, 'Photo activity requires a real profile.');
    if (req.method === 'GET' && match[2] === 'availability')
      return { status: 200, body: unavailable };
    if (req.method === 'POST' && match[2] === 'photos')
      return { status: 503, body: unavailable };
    throw new ApiError(405, 'Method not allowed.');
  };
}
