import type { IncomingMessage } from 'node:http';
import type { Pool } from 'pg';
import { z } from 'zod';
import { authenticateSession } from '../auth/session.ts';
import { readOwnedProfile } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';
import { claimPhotoActivity } from './claims.ts';
import { decodePhoto } from './media.ts';
import { createActivityAssessment } from '../ai/activity-assessment.ts';
import { isLocalAwardFixture } from './fixture.ts';

const unavailable = { kind: 'unavailable', creditedPoints: 0 } as const;

const photoRequest = z.strictObject({
  profileId: z.uuid(),
  capture: z.enum(['camera', 'gallery']),
  mime: z.enum(['image/jpeg', 'image/png']),
  photoBase64: z
    .string()
    .regex(/^[A-Za-z0-9+/]*={0,2}$/)
    .max(2_800_000),
  description: z.string().trim().min(1).max(1600),
  requestId: z.uuid(),
  activity: z.enum(['bus-trip', 'other']),
});

async function readPhotoBody(req: IncomingMessage) {
  if (req.headers['content-type'] !== 'application/json')
    throw new ApiError(415, 'Use application/json.');
  const chunks: Buffer[] = [];
  let size = 0;
  let joined: Buffer | undefined;
  for await (const chunk of req) {
    const value = Buffer.from(chunk);
    size += value.byteLength;
    if (size > 2_850_000) {
      value.fill(0);
      chunks.forEach((part) => part.fill(0));
      throw new ApiError(413, 'Photo request is too large.');
    }
    chunks.push(value);
  }
  try {
    joined = Buffer.concat(chunks);
    const value: unknown = JSON.parse(joined.toString('utf8'));
    return photoRequest.parse(value);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Invalid photo request.');
  } finally {
    joined?.fill(0);
    chunks.forEach((part) => part.fill(0));
  }
}

/** Production stays disabled; explicit loopback synthetic mode exercises the local flow. */
export function createPhotoHandler(
  pool: Pool,
  env: Record<string, string | undefined> = process.env,
) {
  const fixtureEnabled =
    env.PHOTO_ACTIVITY_DEV_ENABLED === 'true' &&
    (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') &&
    env.API_HOST === '127.0.0.1' &&
    env.AUTH_DEV_ENABLED === 'true';
  const assessFixture = (fixtureImage: boolean) =>
    createActivityAssessment({
      provider: {
        observe: async ({ photo, mime, description }) => ({
          observations: [
            `Fixture image ${mime} with ${photo.byteLength} bytes. ${description.slice(0, 120)}`,
          ],
        }),
        decide: async () => ({
          verdict: fixtureImage ? 'supported' : 'not-supported',
          activity: 'bus-trip',
          confidence: fixtureImage ? 0.75 : 0,
        }),
      },
    });
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
      return {
        status: 200,
        body: fixtureEnabled
          ? { kind: 'available', creditedPoints: 50 }
          : unavailable,
      };
    if (req.method === 'POST' && match[2] === 'photos') {
      if (!fixtureEnabled) return { status: 503, body: unavailable };
      const input = await readPhotoBody(req);
      if (input.profileId !== id.data)
        throw new ApiError(400, 'Profile does not match the request.');
      const encoded = Buffer.from(input.photoBase64, 'base64');
      input.photoBase64 = '';
      if (!encoded.byteLength || encoded.byteLength > 2_000_000) {
        encoded.fill(0);
        throw new ApiError(413, 'Photo must be at most 2 MB.');
      }
      const decoded = await decodePhoto(encoded, input.mime);
      const fingerprint = decoded.fingerprint;
      const result = await assessFixture(
        isLocalAwardFixture(fingerprint, input.activity),
      ).assess({
        photo: decoded.photo,
        mime: decoded.mime,
        capture: 'camera',
        description: input.description,
        fingerprint,
        eligibility: {
          eligible: true,
          duplicate: false,
          actionAlreadyRewarded: false,
          tripAlreadyRewarded: false,
        },
      });
      input.description = '';
      if (result.kind === 'unavailable')
        return { status: 503, body: { ...unavailable, reason: result.reason } };
      if (result.kind !== 'candidate')
        return {
          status: 200,
          body: {
            kind: 'rejected',
            activity: input.activity,
            object: 'Synthetic fixture',
            creditedPoints: 0,
            source: 'local_fixture',
            message: 'Only the server-owned local fixture can earn points.',
          },
        };
      const credited = await claimPhotoActivity(
        pool,
        header.slice(7),
        {
          profileId: id.data,
          requestId: input.requestId,
          fingerprint,
          journeyId: null,
          activity: result.activity,
          verdict: 'supported',
          confidence: result.confidence,
        },
        'synthetic_test',
      );
      return {
        status: 201,
        body: {
          kind: 'verified',
          activity: result.activity,
          object: 'Synthetic fixture',
          creditedPoints: credited.outcome.creditedPoints,
          receiptId: credited.outcome.receiptId,
          source: 'local_fixture',
          message:
            'Synthetic local fixture award; no visual classification ran.',
        },
      };
    }
    throw new ApiError(405, 'Method not allowed.');
  };
}
