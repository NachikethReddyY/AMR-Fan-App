import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { decodePhoto } from './media.ts';

test('canonical pixels ignore metadata, discard input, and return metadata-free JPEG', async () => {
  const make = () =>
    sharp({
      create: { width: 12, height: 8, channels: 3, background: '#004a4d' },
    });
  const a = await make().png().toBuffer();
  const b = await make().withMetadata({ density: 144 }).png().toBuffer();
  const first = await decodePhoto(a, 'image/png');
  const second = await decodePhoto(b, 'image/png');
  assert.equal(first.fingerprint, second.fingerprint);
  assert.ok(a.every((v) => v === 0));
  assert.ok(b.every((v) => v === 0));
  const metadata = await sharp(first.photo).metadata();
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.format, 'jpeg');
  first.photo.fill(0);
  second.photo.fill(0);
});

test('malformed, MIME mismatch, byte bound and decompression-heavy images fail closed', async () => {
  const heavy = await sharp({
    create: { width: 5000, height: 5000, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  for (const bytes of [
    Buffer.from('not an image'),
    Buffer.alloc(2_000_001),
    heavy,
  ]) {
    await assert.rejects(decodePhoto(bytes, 'image/png'));
    assert.ok(bytes.every((v) => v === 0));
  }
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  await assert.rejects(decodePhoto(png, 'image/jpeg'));
});

test('single admission slot rejects overlapping decodes and disposes their bytes', async () => {
  const a = await sharp({
    create: { width: 20, height: 20, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  const b = Buffer.from(a);
  const first = decodePhoto(a, 'image/png');
  await assert.rejects(decodePhoto(b, 'image/png'), /busy/);
  assert.ok(b.every((v) => v === 0));
  (await first).photo.fill(0);
});
