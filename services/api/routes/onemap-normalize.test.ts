import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeOneMap,
  resolveOneMapAddress,
  searchOneMapAddresses,
} from './onemap-normalize.ts';
import { road, roadFor, transit, address } from './testing/onemap-fixtures.ts';
import { decodePolyline } from './normalize.ts';

test('road summary and returned polyline become OneMap evidence without invented geometry', async () => {
  for (const mode of ['DRIVE', 'WALK', 'BICYCLE'] as const) {
    const result = await normalizeOneMap(mode, roadFor(mode));
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
test('walking instructions cannot masquerade as cycling or driving', async () => {
  for (const mode of ['BICYCLE', 'DRIVE'] as const)
    assert.deepEqual(await normalizeOneMap(mode, road), {
      kind: 'unavailable',
      reason: 'missing_data',
    });
  for (const instructions of [
    [],
    [['Head']],
    road.route_instructions.map((instruction) =>
      instruction.map((value, index) => (index === 8 ? 'unknown' : value)),
    ),
    [roadFor('BICYCLE').route_instructions[0], road.route_instructions[1]],
  ])
    assert.deepEqual(
      await normalizeOneMap('BICYCLE', {
        ...road,
        route_instructions: instructions,
      }),
      { kind: 'unavailable', reason: 'missing_data' },
    );
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
test('long MRT legs and long walking instruction lists stay inside bounded evidence limits', async () => {
  // OneMap encodes each coordinate in at least two characters, so an ordinary
  // cross-island MRT leg carries several thousand points and a long walk carries
  // well over a hundred instructions. Both were rejected before.
  function encodePolyline(
    points: readonly { latitude: number; longitude: number }[],
  ) {
    let latitude = 0;
    let longitude = 0;
    let encoded = '';
    const value = (delta: number) => {
      let remaining = delta < 0 ? ~(delta << 1) : delta << 1;
      let text = '';
      while (remaining >= 0x20) {
        text += String.fromCharCode((0x20 | (remaining & 0x1f)) + 63);
        remaining >>>= 5;
      }
      return text + String.fromCharCode(remaining + 63);
    };
    for (const point of points) {
      const a = Math.round(point.latitude * 1e5);
      const b = Math.round(point.longitude * 1e5);
      encoded += value(a - latitude) + value(b - longitude);
      latitude = a;
      longitude = b;
    }
    return encoded;
  }
  const zigzag = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      latitude: 1.29 + (index % 2 === 0 ? 0 : 0.002),
      longitude: 103.85 + (index % 2 === 0 ? 0 : 0.002),
    }));
  const points = encodePolyline(zigzag(3001));
  const decoded = decodePolyline(points);
  assert.ok(decoded && decoded.length === 3001);
  const subway = transit();
  const leg = subway.plan.itineraries[0].legs[1];
  leg.mode = 'SUBWAY';
  leg.from = {
    name: 'Synthetic start',
    lat: decoded[0].latitude,
    lon: decoded[0].longitude,
  };
  leg.to = {
    name: 'Synthetic end',
    lat: decoded[decoded.length - 1].latitude,
    lon: decoded[decoded.length - 1].longitude,
  };
  leg.legGeometry = { points, length: 3001 };
  assert.equal((await normalizeOneMap('TRANSIT', subway)).kind, 'routes');

  const walking = roadFor('WALK');
  walking.route_instructions = Array.from(
    { length: 300 },
    () => road.route_instructions[0],
  );
  assert.equal((await normalizeOneMap('WALK', walking)).kind, 'routes');

  const excessive = transit();
  excessive.plan.itineraries[0].legs[1].legGeometry = {
    points: encodePolyline(zigzag(40_000)),
    length: 40_000,
  };
  assert.deepEqual(await normalizeOneMap('TRANSIT', excessive), {
    kind: 'unavailable',
    reason: 'missing_data',
  });
  const excessiveInstructions = roadFor('WALK');
  excessiveInstructions.route_instructions = Array.from(
    { length: 3000 },
    () => road.route_instructions[0],
  );
  assert.deepEqual(await normalizeOneMap('WALK', excessiveInstructions), {
    kind: 'unavailable',
    reason: 'missing_data',
  });
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
    // Each leg's own verified shape is kept for map drawing even though the
    // joints do not line up; gaps stay gaps.
    assert.equal(result.evidence[0].legShapes.length, 2);
    for (const shape of result.evidence[0].legShapes)
      assert.ok(shape.points.length >= 2);
  }
});

test('continuous OneMap leg geometry remains bound to its original leg ordering', async () => {
  const result = await normalizeOneMap('TRANSIT', transit());
  if (result.kind !== 'routes') throw new Error('No route');
  assert.equal(result.evidence[0].legGeometry?.kind, 'provider');
  const geometry = result.evidence[0].legGeometry;
  if (geometry?.kind !== 'provider') return;
  assert.deepEqual(
    geometry.legs.map((l) => l.legIndex),
    [0, 1],
  );
});

test('place search keeps only bounded Singapore suggestions', () => {
  const result = searchOneMapAddresses({
    results: [
      {
        SEARCHVAL: 'Bayfront MRT Station',
        ADDRESS: '10 Bayfront Avenue',
        POSTAL: '018956',
        LATITUDE: '1.2816',
        LONGITUDE: '103.8602',
      },
      {
        SEARCHVAL: 'Outside Singapore',
        ADDRESS: 'Elsewhere',
        POSTAL: '000000',
        LATITUDE: '51.5',
        LONGITUDE: '-0.1',
      },
    ],
  });
  assert.equal(result.kind, 'places');
  if (result.kind === 'places') {
    assert.equal(result.places.length, 1);
    assert.equal(result.places[0]?.label, 'Bayfront MRT Station');
    assert.deepEqual(result.places[0]?.coordinate, {
      latitude: 1.2816,
      longitude: 103.8602,
    });
  }
});
