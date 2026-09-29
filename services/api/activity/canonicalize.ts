import { createHash } from 'node:crypto';
import { ApiError } from '../accounts/types.ts';
import { decodePhoto } from './media.ts';
import type { ActivitySubmissionInput } from './submission-contract.ts';

export const ACTIVITY_EVIDENCE_POLICY_VERSION = 'activity-evidence-v1';

export type CanonicalActivityPhoto = {
  /** Metadata-free, resized JPEG bytes. The caller owns and must clear them. */
  bytes: Buffer;
  fingerprint: string;
};
export type CanonicalActivitySubmission = {
  requestId: string;
  description: string;
  missionId: string | null;
  payloadDigest: string;
  photos: CanonicalActivityPhoto[];
};

/**
 * Decodes photos one at a time, so raw input and pixel buffers do not accumulate
 * across the batch. No original media is returned or written to storage.
 */
export async function canonicalizeActivitySubmission(
  input: ActivitySubmissionInput,
  signal?: AbortSignal,
): Promise<CanonicalActivitySubmission> {
  const photos: CanonicalActivityPhoto[] = [];
  const seen = new Set<string>();
  try {
    for (const item of input.photos) {
      if (signal?.aborted) throw new Error('Activity submission cancelled.');
      const source = Buffer.from(item.base64, 'base64');
      try {
        const canonical = await decodePhoto(source, item.mime);
        if (seen.has(canonical.fingerprint)) {
          canonical.photo.fill(0);
          throw new ApiError(400, 'Duplicate photos are not allowed.');
        }
        seen.add(canonical.fingerprint);
        photos.push({
          bytes: canonical.photo,
          fingerprint: canonical.fingerprint,
        });
        if (signal?.aborted) throw new Error('Activity submission cancelled.');
      } finally {
        source.fill(0);
      }
    }
    const binding = JSON.stringify([
      ACTIVITY_EVIDENCE_POLICY_VERSION,
      input.description,
      input.missionId,
      photos.map(({ fingerprint }) => fingerprint),
    ]);
    return {
      requestId: input.requestId,
      description: input.description,
      missionId: input.missionId,
      payloadDigest: createHash('sha256').update(binding).digest('hex'),
      photos,
    };
  } catch (error) {
    for (const photo of photos) photo.bytes.fill(0);
    throw error;
  }
}

export function clearCanonicalActivitySubmission(
  value: Pick<CanonicalActivitySubmission, 'photos'> | undefined,
) {
  for (const photo of value?.photos ?? []) photo.bytes.fill(0);
}
