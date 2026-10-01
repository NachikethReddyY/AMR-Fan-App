import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ApiError } from '../accounts/types.ts';
import { MAX_DECODED_PHOTO_BYTES } from './submission-contract.ts';

// One bounded decode per process. No pixel cache survives a request.
sharp.cache(false);
let decoding = false;
/** The decoded and canonical media limit is frozen at two mebibytes. */
export const MAX_PHOTO_BYTES = MAX_DECODED_PHOTO_BYTES;
export const MAX_PHOTO_PIXELS = 16_000_000;

/** Consumes the input; returns only stripped JPEG bytes and a canonical pixel hash. */
export async function decodePhoto(
  bytes: Uint8Array,
  mime: 'image/jpeg' | 'image/png',
) {
  let pixels: Buffer | undefined;
  let admitted = false;
  try {
    if (!bytes.byteLength || bytes.byteLength > MAX_PHOTO_BYTES)
      throw new ApiError(413, 'Photo must be at most 2 MiB.');
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => bytes[index] === byte,
    );
    if ((mime === 'image/jpeg' && !jpeg) || (mime === 'image/png' && !png))
      throw new ApiError(400, 'Use a still JPEG or PNG photo.');
    if (decoding) throw new ApiError(503, 'Photo processing is busy.');
    decoding = true;
    admitted = true;
    const decoder = sharp(bytes, {
      limitInputPixels: MAX_PHOTO_PIXELS,
      sequentialRead: true,
      failOn: 'warning',
    }).timeout({ seconds: 5 });
    const metadata = await decoder.metadata();
    if (
      metadata.format !== (mime === 'image/jpeg' ? 'jpeg' : 'png') ||
      (metadata.pages ?? 1) !== 1
    )
      throw new ApiError(400, 'Use a still JPEG or PNG photo.');
    const raw = await decoder
      .autoOrient()
      .toColourspace('srgb')
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    pixels = raw.data;
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([raw.info.width, raw.info.height, raw.info.channels]),
      )
      .update(pixels)
      .digest('hex');
    const photo = await sharp(pixels, { raw: raw.info })
      .timeout({ seconds: 5 })
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    if (photo.byteLength > MAX_PHOTO_BYTES) {
      photo.fill(0);
      throw new ApiError(413, 'Photo is too large.');
    }
    return { photo, mime: 'image/jpeg' as const, fingerprint };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Photo could not be decoded.');
  } finally {
    pixels?.fill(0);
    bytes.fill(0);
    if (admitted) decoding = false;
  }
}
