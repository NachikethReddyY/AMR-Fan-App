import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { decodePhoto } from './media.ts';
import { isLocalAwardFixture } from './fixture.ts';

test('only the pinned synthetic image and bus activity qualify for local points', async () => {
  const fixture = await sharp({
    create: { width: 10, height: 10, channels: 3, background: '#004a4d' },
  })
    .jpeg()
    .toBuffer();
  const accepted = await decodePhoto(fixture, 'image/jpeg');
  assert.equal(isLocalAwardFixture(accepted.fingerprint, 'bus-trip'), true);
  assert.equal(isLocalAwardFixture(accepted.fingerprint, 'other'), false);
  accepted.photo.fill(0);

  const arbitrary = await sharp({
    create: { width: 10, height: 10, channels: 3, background: '#aa1133' },
  })
    .jpeg()
    .toBuffer();
  const rejected = await decodePhoto(arbitrary, 'image/jpeg');
  assert.equal(isLocalAwardFixture(rejected.fingerprint, 'bus-trip'), false);
  rejected.photo.fill(0);
});
