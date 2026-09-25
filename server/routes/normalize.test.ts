import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeResponse } from './normalize.ts';

// Independently encoded polyline5: (1.29,103.85), (1.30,103.85).
const encoded = 'o}zFoezxRo}@?';
function route(polyline = encoded) {
  return {
    routes: [
      {
        distanceMeters: 1000,
        duration: '600s',
        polyline: { encodedPolyline: polyline },
        legs: [
          {
            startLocation: { latLng: { latitude: 1.29, longitude: 103.85 } },
            endLocation: { latLng: { latitude: 1.3, longitude: 103.85 } },
            steps: [
              {
                travelMode: 'DRIVE',
                distanceMeters: 1000,
                staticDuration: '600s',
              },
            ],
          },
        ],
      },
    ],
  };
}
test('geometry binds exact route ID, provider endpoints and ordered coordinates to indicative applicability', () => {
  const result = normalizeResponse('DRIVE', route());
  assert.equal(result.kind, 'routes');
  if (result.kind !== 'routes') return;
  assert.equal(result.evidence[0].routeId, result.routes[0].id);
  assert.equal(result.evidence[0].factorApplicability, 'singapore_indicative');
  const geometry = result.evidence[0].geometry;
  assert.equal(geometry.kind, 'provider');
  if (geometry.kind === 'provider') {
    assert.deepEqual(geometry.start, { latitude: 1.29, longitude: 103.85 });
    assert.equal(geometry.points.length, 2);
    assert.ok(Math.abs(geometry.points[1].latitude - 1.3) < 1e-10);
  }
});
test('missing geometry is explicit; malformed encoding, excessive vertices and endpoint mismatch fail closed', () => {
  const missing = route();
  const { polyline: _omitted, ...without } = missing.routes[0];
  const result = normalizeResponse('DRIVE', { routes: [without] });
  assert.equal(result.kind, 'routes');
  if (result.kind === 'routes')
    assert.deepEqual(result.evidence[0].geometry, {
      kind: 'unavailable',
      reason: 'missing_geometry',
    });
  for (const text of [
    '~',
    '?????????',
    '_'.repeat(50),
    '??'.repeat(2049),
    'invalid unicode ✕',
  ]) {
    assert.deepEqual(normalizeResponse('DRIVE', route(text)), {
      kind: 'unavailable',
      reason: 'missing_data',
    });
  }
  const mismatched = route();
  mismatched.routes[0].legs[0].endLocation.latLng.latitude = 1.4;
  assert.deepEqual(normalizeResponse('DRIVE', mismatched), {
    kind: 'unavailable',
    reason: 'missing_data',
  });
});

test('non-transit duration contradictions cannot inflate the fastest-route limit', () => {
  const raw = route();
  raw.routes[0].duration = '6000s';
  assert.deepEqual(normalizeResponse('DRIVE', raw), {
    kind: 'unavailable',
    reason: 'missing_data',
  });
});
