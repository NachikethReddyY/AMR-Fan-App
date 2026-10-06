import type { TransportCoordinate } from './contracts.ts';

/** Straight-line metres with the planner's small projection allowance. */
export function distanceBetween(
  a: TransportCoordinate,
  b: TransportCoordinate,
) {
  const latitude = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const dLat = (b.latitude - a.latitude) * (Math.PI / 180);
  const dLon = (b.longitude - a.longitude) * (Math.PI / 180);
  const radius = 6_371_000;
  const sine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * (Math.PI / 180)) *
      Math.cos(b.latitude * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return (
    2 *
    radius *
    Math.atan2(Math.sqrt(sine), Math.sqrt(1 - sine)) *
    (1 + Math.abs(Math.cos(latitude)) * 0.002)
  );
}
