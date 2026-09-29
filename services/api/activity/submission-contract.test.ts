import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseActivitySubmission } from './submission-contract.ts';

const id = '123e4567-e89b-42d3-a456-426614174000';
const tiny = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2w==', 'base64').toString(
  'base64',
);
const photo = (base64 = tiny) => ({ mime: 'image/jpeg', base64 });
const request = (overrides = {}) => ({
  requestId: id,
  description: '  A bus ride to the race week venue.  ',
  photos: [photo()],
  ...overrides,
});

test('accepts 1–5 distinct photos and normalizes requestId/description', () => {
  for (const count of [1, 5]) {
    const photos = Array.from({ length: count }, (_, i) =>
      photo(Buffer.from(`${tiny}${i}`).toString('base64')),
    );
    const parsed = parseActivitySubmission(request({ photos }));
    assert.equal(parsed.photos.length, count);
  }
  assert.equal(
    parseActivitySubmission(request()).description,
    'A bus ride to the race week venue.',
  );
});

test('rejects invalid UUID, empty/overlong description, count, MIME and strict base64', () => {
  for (const value of [
    request({ requestId: 'rk-activity-001' }),
    request({ photos: [] }),
    request({ photos: Array.from({ length: 6 }, () => photo()) }),
    request({ description: 'x'.repeat(1601) }),
    request({ photos: [{ mime: 'image/gif', base64: tiny }] }),
    request({ photos: [photo('%%%not-base64%%%')] }),
  ])
    assert.throws(() => parseActivitySubmission(value));
});

test('normalizes optional journey linking', () => {
  assert.equal(
    parseActivitySubmission(request({ journeyId: id })).journeyId,
    id,
  );
});

test('rejects a single decoded photo over 2 MiB and aggregate photos over 8 MiB', () => {
  const overSingle = Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64');
  assert.throws(() =>
    parseActivitySubmission(request({ photos: [photo(overSingle)] })),
  );
  const overTotal = Array.from({ length: 5 }, () =>
    photo(Buffer.alloc(1_700_000).toString('base64')),
  );
  assert.throws(() => parseActivitySubmission(request({ photos: overTotal })));
});
