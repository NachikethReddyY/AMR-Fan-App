import { z } from 'zod';
import { ApiError } from '../accounts/types.ts';

/** The JSON transport limit includes field names and base64 expansion. */
export const MAX_SUBMISSION_BODY_BYTES = 14 * 1024 * 1024;
export const MAX_SUBMISSION_PHOTOS = 5;
export const MAX_SUBMISSION_DESCRIPTION = 1600;
export const MAX_DECODED_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_DECODED_SUBMISSION_BYTES = 8 * 1024 * 1024;

const base64 = z
  .string()
  .min(4)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u);
const photo = z.strictObject({
  mime: z.enum(['image/jpeg', 'image/png']),
  base64,
});
const wire = z.strictObject({
  requestId: z.uuid(),
  description: z.string(),
  photos: z.array(photo).min(1).max(MAX_SUBMISSION_PHOTOS),
  missionId: z.uuid().nullable().optional(),
});

export type ActivitySubmissionPhoto = z.infer<typeof photo>;
export type ActivitySubmissionInput = {
  requestId: string;
  description: string;
  photos: ActivitySubmissionPhoto[];
  missionId: string | null;
};

function decodedLength(encoded: string) {
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return (encoded.length / 4) * 3 - padding;
}

/**
 * Parse the untrusted JSON object once at the HTTP boundary. This function does
 * not decode or retain media; canonical pixel validation belongs to media.ts.
 */
export function parseActivitySubmission(
  value: unknown,
): ActivitySubmissionInput {
  let encodedBytes: number;
  try {
    encodedBytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    throw new ApiError(400, 'Invalid activity submission.');
  }
  if (encodedBytes > MAX_SUBMISSION_BODY_BYTES)
    throw new ApiError(413, 'Activity submission is too large.');

  const parsed = wire.safeParse(value);
  if (!parsed.success) throw new ApiError(400, 'Invalid activity submission.');
  const description = parsed.data.description.normalize('NFC').trim();
  if (
    !description ||
    description.length > MAX_SUBMISSION_DESCRIPTION ||
    !/\S/u.test(description)
  )
    throw new ApiError(
      400,
      'Use a description between 1 and 1,600 characters.',
    );

  let total = 0;
  for (const item of parsed.data.photos) {
    const bytes = decodedLength(item.base64);
    if (
      !Number.isSafeInteger(bytes) ||
      bytes <= 0 ||
      bytes > MAX_DECODED_PHOTO_BYTES
    )
      throw new ApiError(413, 'Each photo must decode to at most 2 MiB.');
    // Buffer.from is intentionally performed only for validation and discarded.
    const decoded = Buffer.from(item.base64, 'base64');
    try {
      if (
        decoded.byteLength !== bytes ||
        decoded.toString('base64') !== item.base64
      )
        throw new ApiError(400, 'Photo data is not valid canonical base64.');
    } finally {
      decoded.fill(0);
    }
    total += bytes;
  }
  if (total > MAX_DECODED_SUBMISSION_BYTES)
    throw new ApiError(413, 'Activity photos are too large together.');
  return {
    requestId: parsed.data.requestId.toLowerCase(),
    description,
    photos: parsed.data.photos.map((item) => ({ ...item })),
    missionId: parsed.data.missionId?.toLowerCase() ?? null,
  };
}
