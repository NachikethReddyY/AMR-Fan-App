import assert from 'node:assert/strict';
import { test } from 'node:test';
import { singaporeRouteGeography, boundarySource } from './geography.ts';

test('pinned official geography accepts central Singapore evidence and rejects outside, boundary and unknown evidence', () => {
  assert.equal(
    boundarySource.sha256,
    '2ac87b6da63c39d6311c7bc018aafddbffcfa18fd8faed09243207c9b502627d',
  );
  assert.equal(
    singaporeRouteGeography([
      { latitude: 1.29, longitude: 103.85 },
      { latitude: 1.3, longitude: 103.85 },
    ]),
    'Singapore',
  );
  assert.equal(
    singaporeRouteGeography([
      { latitude: 1.49, longitude: 103.74 },
      { latitude: 1.5, longitude: 103.74 },
    ]),
    null,
  );
  assert.equal(singaporeRouteGeography([]), null);
  assert.equal(
    singaporeRouteGeography([
      { latitude: 1.1599682514469214, longitude: 103.74134282930031 },
      { latitude: 1.3, longitude: 103.85 },
    ]),
    null,
  );
  assert.equal(
    singaporeRouteGeography([
      { latitude: 1.29, longitude: 103.85 },
      { latitude: 1.49, longitude: 103.74 },
    ]),
    null,
  );
});

test('two in-country endpoints do not authorize a segment across the sea', () => {
  // Southern islands and mainland are in the polygon union, but this chord crosses water.
  assert.equal(
    singaporeRouteGeography([
      { latitude: 1.215, longitude: 103.85 },
      { latitude: 1.29, longitude: 103.85 },
    ]),
    null,
  );
});
