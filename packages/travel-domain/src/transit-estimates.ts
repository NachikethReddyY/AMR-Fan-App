import {
  factorGas,
  factorValue,
  type EmissionFactor,
  type RouteEstimate,
} from './emissions.ts';
import type { LegMode } from './routes.ts';

export type TransitLegInput = {
  kind: string;
  mode: string;
  /** Straight-line metres between the leg endpoints; null when unknown. */
  distanceMeters: number | null;
};

/**
 * Estimates a transport-plan route from per-leg straight-line distances.
 * Waiting and transferring involve no vehicle movement and contribute zero.
 * Legs whose factor is zero contribute zero whatever their length, so unknown
 * active-travel distances stay exact. Motorized legs without a measurable
 * distance, or modes without a factor, stay unavailable instead of guessed.
 */
export function estimateTransitRoute(
  legs: readonly TransitLegInput[],
  factors: readonly EmissionFactor[],
): RouteEstimate {
  if (legs.length === 0)
    return { kind: 'unavailable', reason: 'invalid_route' };
  let kg = 0;
  let gas: 'CO2' | 'CO2e' | undefined;
  const factorIds: string[] = [];
  for (const leg of legs) {
    if (
      leg.distanceMeters !== null &&
      (!Number.isFinite(leg.distanceMeters) || leg.distanceMeters < 0)
    )
      return { kind: 'unavailable', reason: 'invalid_route' };
    const factor = factors.find(
      (entry) => entry.mode === leg.mode && entry.geography === 'Singapore',
    );
    if (
      !factor ||
      !Number.isFinite(factorValue(factor)) ||
      factorValue(factor) < 0
    ) {
      return {
        kind: 'unavailable',
        reason: 'missing_factor',
        mode: leg.mode as LegMode,
      };
    }
    if (gas && factorGas(factor) !== gas)
      return { kind: 'unavailable', reason: 'incompatible_gases' };
    gas = factorGas(factor);
    const distance =
      leg.kind === 'wait' || leg.kind === 'transfer'
        ? 0
        : factorValue(factor) === 0
          ? 0
          : leg.distanceMeters;
    if (distance === null)
      return { kind: 'unavailable', reason: 'invalid_route' };
    const legKg = (distance / 1000) * factorValue(factor);
    if (!Number.isFinite(legKg))
      return { kind: 'unavailable', reason: 'invalid_route' };
    kg += legKg;
    if (!Number.isFinite(kg))
      return { kind: 'unavailable', reason: 'invalid_route' };
    factorIds.push(factor.id);
  }
  return gas === 'CO2'
    ? { kind: 'estimated_co2', gas: 'CO2', unit: 'kgCO2', kg, factorIds }
    : { kind: 'estimated', kgCo2e: kg, factorIds };
}
