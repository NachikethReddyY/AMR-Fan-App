import assert from 'node:assert/strict';
import { test } from 'node:test';
import { singaporeRouteGeography, boundarySource } from './geography.ts';

test('pinned official geography accepts central Singapore evidence and rejects outside, boundary and unknown evidence', async () => {
  assert.equal(
    boundarySource.sha256,
    '2ac87b6da63c39d6311c7bc018aafddbffcfa18fd8faed09243207c9b502627d',
  );
  assert.equal(
    await singaporeRouteGeography([
      { latitude: 1.29, longitude: 103.85 },
      { latitude: 1.3, longitude: 103.85 },
    ]),
    'Singapore',
  );
  assert.equal(
    await singaporeRouteGeography([
      { latitude: 1.49, longitude: 103.74 },
      { latitude: 1.5, longitude: 103.74 },
    ]),
    null,
  );
  assert.equal(await singaporeRouteGeography([]), null);
  assert.equal(
    await singaporeRouteGeography([
      { latitude: 1.1599682514469214, longitude: 103.74134282930031 },
      { latitude: 1.3, longitude: 103.85 },
    ]),
    null,
  );
  assert.equal(
    await singaporeRouteGeography([
      { latitude: 1.29, longitude: 103.85 },
      { latitude: 1.49, longitude: 103.74 },
    ]),
    null,
  );
});

test('two in-country endpoints do not authorize a segment across the sea', async () => {
  // Southern islands and mainland are in the polygon union, but this chord crosses water.
  assert.equal(
    await singaporeRouteGeography([
      { latitude: 1.215, longitude: 103.85 },
      { latitude: 1.29, longitude: 103.85 },
    ]),
    null,
  );
});

test('all-identical paths have no applicable geography; duplicates and closed loops retain usable segments', async () => {
  const a = { latitude: 1.29, longitude: 103.85 };
  const b = { latitude: 1.3, longitude: 103.85 };
  assert.equal(await singaporeRouteGeography([a, a]), null);
  assert.equal(await singaporeRouteGeography([a, a, a]), null);
  assert.equal(await singaporeRouteGeography([a, a, b, b]), 'Singapore');
  assert.equal(await singaporeRouteGeography([a, b, a]), 'Singapore');
});

test('containment observes cancellation while processing a maximum-size path', async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5);
  try {
    await assert.rejects(
      singaporeRouteGeography(
        Array.from({ length: 2048 }, (_, i) => ({
          latitude: 1.29 + i / 1_000_000,
          longitude: 103.85 + i / 1_000_000,
        })),
        controller.signal,
      ),
      { name: 'AbortError' },
    );
  } finally {
    clearTimeout(timer);
  }
});
