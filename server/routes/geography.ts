import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { setImmediate } from 'node:timers/promises';
import { z } from 'zod';

export const coordinate = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type Coordinate = z.infer<typeof coordinate>;
export function hasDistinctPoints(points: readonly Coordinate[]): boolean {
  const first = points[0];
  return (
    first !== undefined &&
    points.some(
      (point) =>
        point.latitude !== first.latitude ||
        point.longitude !== first.longitude,
    )
  );
}
export const boundarySource = {
  id: 'ura-mp2019-regions-no-sea-2025-12-03',
  url: 'https://data.gov.sg/datasets/d_bf4d24df9129d5a8ff8cf82e20959ee0/view',
  sha256: '2ac87b6da63c39d6311c7bc018aafddbffcfa18fd8faed09243207c9b502627d',
  licence: 'https://data.gov.sg/open-data-licence',
  attribution:
    'Contains information from URA Master Plan 2019 Region Boundary (No Sea), accessed 25 September 2026 from data.gov.sg under Singapore Open Data Licence 1.0. Indicative planning geography; no official endorsement.',
} as const;
const bytes = gunzipSync(
  readFileSync(new URL('./data/singapore-regions.geojson.gz', import.meta.url)),
  { maxOutputLength: 2_000_000 },
);
if (createHash('sha256').update(bytes).digest('hex') !== boundarySource.sha256)
  throw new Error('Route geography integrity check failed.');
const point = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const ring = z.array(point).min(4).max(30000);
const dataset = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z
      .array(
        z.object({
          geometry: z.object({
            type: z.literal('MultiPolygon'),
            coordinates: z.array(z.array(ring).min(1)).max(1000),
          }),
        }),
      )
      .length(5),
  })
  .parse(JSON.parse(bytes.toString()));
type Point = z.infer<typeof point>;
const polygons = dataset.features.flatMap(
  (feature) => feature.geometry.coordinates,
);
const edges = polygons.flatMap((polygon) =>
  polygon.flatMap((r) => r.slice(1).map((b, i) => ({ a: r[i], b }))),
);
function bounds(points: Point[]) {
  return {
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[0])),
    minY: Math.min(...points.map((p) => p[1])),
    maxY: Math.max(...points.map((p) => p[1])),
  };
}
const polygonBounds = polygons.map((polygon) => bounds(polygon[0]));

function ringContains(p: Point, r: Point[]) {
  let inside = false;
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1],
      b = r[i];
    const determinant =
      (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]);
    if (
      Math.abs(determinant) < 1e-12 &&
      p[0] >= Math.min(a[0], b[0]) - 1e-10 &&
      p[0] <= Math.max(a[0], b[0]) + 1e-10 &&
      p[1] >= Math.min(a[1], b[1]) - 1e-10 &&
      p[1] <= Math.max(a[1], b[1]) + 1e-10
    )
      return null;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function contains(p: Point) {
  return polygons.some(
    (polygon, index) =>
      p[0] >= polygonBounds[index].minX &&
      p[0] <= polygonBounds[index].maxX &&
      p[1] >= polygonBounds[index].minY &&
      p[1] <= polygonBounds[index].maxY &&
      ringContains(p, polygon[0]) === true &&
      polygon.slice(1).every((hole) => ringContains(p, hole) === false),
  );
}
function cross(a: Point, b: Point) {
  return a[0] * b[1] - a[1] * b[0];
}
function subtract(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1]];
}
function interpolate(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function isSingaporeCoordinate(value: Coordinate): boolean {
  return contains([value.longitude, value.latitude]);
}

// Check the supplied geometry only. Internal region borders are allowed; outer
// boundaries, missing geometry and segments leaving the polygon union fail closed.
export async function singaporeRouteGeography(
  coordinates: readonly Coordinate[],
  signal?: AbortSignal,
): Promise<'Singapore' | null> {
  if (coordinates.length > 2050 || !hasDistinctPoints(coordinates)) return null;
  // Two provider requests can normalize concurrently. Yield between bounded
  // scans instead of blocking the API for an entire route or mode batch.
  await setImmediate(undefined, { signal });
  let yieldAt = performance.now() + 4;
  async function checkpoint() {
    signal?.throwIfAborted();
    if (performance.now() < yieldAt) return;
    await setImmediate(undefined, { signal });
    yieldAt = performance.now() + 4;
  }
  const points: Point[] = coordinates.map((p) => [p.longitude, p.latitude]);
  // These caches live for one bounded geometry check. Exact repeated coordinates
  // and directed segments reuse only successful checks; the supplied path stays
  // intact, including loops, duplicates and every traversal.
  const contained = new Set<string>();
  const checkedSegments = new Set<string>();
  const key = (p: Point) => `${p[0]},${p[1]}`;
  for (const p of points) {
    await checkpoint();
    const pointKey = key(p);
    if (contained.has(pointKey)) continue;
    if (!contains(p)) return null;
    contained.add(pointKey);
  }
  const box = bounds(points);
  const nearbyEdges = edges.filter(
    (edge) =>
      Math.max(edge.a[0], edge.b[0]) >= box.minX &&
      Math.min(edge.a[0], edge.b[0]) <= box.maxX &&
      Math.max(edge.a[1], edge.b[1]) >= box.minY &&
      Math.min(edge.a[1], edge.b[1]) <= box.maxY,
  );
  for (let i = 1; i < points.length; i++) {
    await checkpoint();
    const a = points[i - 1],
      b = points[i],
      ab = subtract(b, a);
    if (ab[0] === 0 && ab[1] === 0) continue;
    const segmentKey = `${key(a)};${key(b)}`;
    if (checkedSegments.has(segmentKey)) continue;
    const cuts = [0, 1];
    for (const [index, edge] of nearbyEdges.entries()) {
      if (index % 256 === 0) await checkpoint();
      if (
        Math.max(a[0], b[0]) < Math.min(edge.a[0], edge.b[0]) ||
        Math.min(a[0], b[0]) > Math.max(edge.a[0], edge.b[0]) ||
        Math.max(a[1], b[1]) < Math.min(edge.a[1], edge.b[1]) ||
        Math.min(a[1], b[1]) > Math.max(edge.a[1], edge.b[1])
      )
        continue;
      const cd = subtract(edge.b, edge.a),
        ac = subtract(edge.a, a),
        denominator = cross(ab, cd);
      if (Math.abs(denominator) < 1e-15) {
        if (Math.abs(cross(ac, ab)) < 1e-15) return null;
        continue;
      }
      const t = cross(ac, cd) / denominator,
        u = cross(ac, ab) / denominator;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) cuts.push(t);
    }
    cuts.sort((x, y) => x - y);
    for (let c = 1; c < cuts.length; c++) {
      await checkpoint();
      if (
        cuts[c] - cuts[c - 1] > 1e-10 &&
        !contains(interpolate(a, b, (cuts[c] + cuts[c - 1]) / 2))
      )
        return null;
    }
    checkedSegments.add(segmentKey);
  }
  signal?.throwIfAborted();
  return 'Singapore';
}
