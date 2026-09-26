import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeOneMap, resolveOneMapAddress } from './onemap-normalize.ts';
import { road, transit, address } from './testing/onemap-fixtures.ts';

test('road summary and returned polyline become OneMap evidence without invented geometry', async () => {
  for (const mode of ['DRIVE', 'WALK', 'BICYCLE'] as const) {
    const result = await normalizeOneMap(mode, road);
    assert.equal(result.kind, 'routes');
    if (result.kind !== 'routes') continue;
    assert.equal(result.routes[0].id, `onemap-${mode.toLowerCase()}-0`);
    assert.equal(result.routes[0].distanceMeters, 1000);
    assert.equal(result.routes[0].durationSeconds, 600);
    assert.equal(
      result.evidence[0].factorApplicability,
      'singapore_indicative',
    );
    assert.equal(result.evidence[0].geometry.kind, 'provider');
  }
});
test('PT retains ordered walk/bus or subway legs, fractional metres and waiting time', async () => {
  for (const mode of ['BUS', 'SUBWAY']) {
    const raw = transit();
    raw.plan.itineraries[0].legs[1].mode = mode;
    const result = await normalizeOneMap('TRANSIT', raw);
    assert.equal(result.kind, 'routes');
    if (result.kind !== 'routes') continue;
    assert.deepEqual(
      result.routes[0].legs.map((l) => l.mode),
      ['walk', mode === 'BUS' ? 'bus' : 'train'],
    );
    assert.equal(result.routes[0].distanceMeters, 1000.5);
    assert.equal(result.routes[0].durationSeconds, 720);
    assert.equal(
      result.routes[0].legs.reduce((n, l) => n + l.durationSeconds, 0),
      600,
    );
    assert.equal(result.evidence[0].geometry.kind, 'provider');
  }
});
test('malformed, contradictory, unsupported or excessive PT data fail closed', async () => {
  const cases: unknown[] = [
    {},
    { plan: { itineraries: Array(4).fill(transit().plan.itineraries[0]) } },
  ];
  for (const change of [
    (r: ReturnType<typeof transit>) => {
      r.plan.itineraries[0].legs[1].mode = 'FERRY';
    },
    (r: ReturnType<typeof transit>) => {
      r.plan.itineraries[0].duration = 1;
    },
    (r: ReturnType<typeof transit>) => {
      r.plan.itineraries[0].legs[1].distance = -1;
    },
    (r: ReturnType<typeof transit>) => {
      r.plan.itineraries[0].legs[1].from.lat = 51.5;
    },
    (r: ReturnType<typeof transit>) => {
      r.plan.itineraries[0].legs[1].legGeometry.points = '???';
    },
    (r: ReturnType<typeof transit>) => {
      r.plan.itineraries[0].legs[1].transitLeg = false;
    },
    (r: ReturnType<typeof transit>) => {
      r.plan.itineraries[0].legs = Array(129).fill(
        r.plan.itineraries[0].legs[0],
      );
    },
  ]) {
    const r = transit();
    change(r);
    cases.push(r);
  }
  for (const raw of cases)
    assert.deepEqual(await normalizeOneMap('TRANSIT', raw), {
      kind: 'unavailable',
      reason: 'missing_data',
    });
  for (const raw of [
    { ...road, route_geometry: undefined },
    { ...road, route_geometry: 'o}zFoezxR??' },
    { ...road, route_summary: { ...road.route_summary, total_time: '600' } },
    { ...road, route_geometry: '_p~iF~ps|U_ulLnnqC' },
  ])
    assert.equal((await normalizeOneMap('WALK', raw)).kind, 'unavailable');
});
test('address search requires one Singapore match and refuses ambiguous, coercible and error payloads', () => {
  assert.deepEqual(resolveOneMapAddress(address()), {
    kind: 'coordinate',
    coordinate: { latitude: 1.29, longitude: 103.85 },
  });
  for (const raw of [
    { ...address(), found: 2 },
    { ...address(), error: 'token expired' },
    { ...address(), results: [] },
    { ...address(), results: [{ LATITUDE: '', LONGITUDE: '103.85' }] },
    { ...address(), results: [{ LATITUDE: '51.5', LONGITUDE: '-0.1' }] },
  ])
    assert.equal(resolveOneMapAddress(raw).kind, 'unavailable');
});

test('documented transit stop/shape offsets preserve metrics but cannot invent a continuous journey path', async () => {
  const raw = transit();
  raw.plan.itineraries[0].legs[1].from.lat = 1.29506;
  const result = await normalizeOneMap('TRANSIT', raw);
  assert.equal(result.kind, 'routes');
  if (result.kind === 'routes') {
    assert.equal(result.routes[0].durationSeconds, 720);
    assert.deepEqual(result.evidence[0].geometry, {
      kind: 'unavailable',
      reason: 'missing_geometry',
    });
    assert.equal(
      result.evidence[0].factorApplicability,
      'geography_unverified',
    );
  }
});
