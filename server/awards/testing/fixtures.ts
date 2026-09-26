import { factorValue } from '../../../src/features/routes/emissions.ts';
import { fingerprint } from '../readiness.ts';
import type { AwardRelease } from '../../journeys/contracts.ts';
import { randomUUID } from 'node:crypto';
import {
  candidatePolicy,
  earningPolicy,
  routeSchema,
} from '../../journeys/contracts.ts';
import { routeFixture } from '../../journeys/fixtures.ts';
import type { JourneySettlementProjection } from '../../journeys/settlement.ts';

// Server-owned arithmetic fixtures only, with no physical or approved-factor claim.
export function awardRoute(baselineKg = 2.4, now = Date.now()) {
  const route = routeFixture(now);
  return routeSchema.parse({
    ...route,
    basis: {
      ...route.basis,
      factorVersions: ['synthetic-car-v1', 'synthetic-bus-v1'],
      calculation: {
        ...route.basis.calculation,
        baseline: {
          ...route.basis.calculation.baseline,
          distanceMeters: 1000,
          legs: [{ mode: 'car', distanceMeters: 1000, durationSeconds: 200 }],
        },
        factors: [
          {
            ...route.basis.calculation.factors[0],
            id: 'synthetic-car-v1',
            mode: 'car',
            kgCo2ePerPassengerKm: baselineKg,
          },
          {
            ...route.basis.calculation.factors[0],
            id: 'synthetic-bus-v1',
            mode: 'bus',
            kgCo2ePerPassengerKm: 0,
          },
        ],
      },
    },
  });
}

export function awardProjection(baselineKg = 2.4): JourneySettlementProjection {
  const route = awardRoute(baselineKg);
  const id = randomUUID();
  return {
    id,
    profileId: randomUUID(),
    state: 'finished',
    source: route.source,
    mode: route.mode,
    basis: route.basis,
    routeEvidence: route.routeEvidence,
    selectedLegs: route.legs,
    assessedLegs: {
      kind: 'available',
      method: 'gps_single_mode_lower_bound',
      legs: route.legs,
    },
    earningPolicy,
    policy: structuredClone(candidatePolicy),
    startedAtMs: 1000,
    finishedAtMs: 301000,
    finishReason: 'arrival',
    assessment: {
      version: candidatePolicy.version,
      calibration: 'unvalidated',
      revision: 2,
      status: 'satisfies_configured_rules',
      reasons: [],
      startRecorded: true,
      arrivalRecorded: true,
      sampleCount: 6,
      elapsedMs: 300000,
      observedDistanceMeters: 1100,
      maxObservedSpeedMps: 4,
      modePlausibility: 'unassessed',
    },
    assessmentIdentity: {
      journeyId: id,
      version: candidatePolicy.version,
      revision: 2,
    },
  };
}

// Deliberately synthetic release metadata for trusted server/DB tests only.
// This helper is never imported by the production composition root.
export function awardReleaseFixture(route: ReturnType<typeof awardRoute>) {
  if (route.basis.calculation.kind !== 'available')
    throw new Error('Fixture basis required.');
  const policy = {
    ...candidatePolicy,
    calibration: 'physical_validated' as const,
    maxSpeedMpsByMode: { bus: 30 },
  };
  const factors = route.basis.calculation.factors.map((f) => ({
    ...f,
    status: 'approved' as const,
  }));
  const proof = {
    reference: 'SYNTHETIC test only, not physical calibration',
    sha256: 'a'.repeat(64),
  };
  const release: AwardRelease = {
    version: 'synthetic-accounting-release-v1',
    assessmentEngine: 'journey-assessment-v1',
    policyFingerprint: fingerprint(policy),
    factorFingerprint: fingerprint(factors),
    geographyVersion: route.routeEvidence.geographyVersion,
    supportedModes: ['bus'],
    distanceMethods: ['gps_single_mode_lower_bound'],
    factorEvidence: {
      ...proof,
      boundary: 'use_phase_co2e',
      baseline: 'single_occupant_ice',
      compatibility: 'Synthetic arithmetic only.',
      units: factors.map((f) => ({
        factorId: f.id,
        sourceValue: factorValue(f),
        sourceUnit:
          f.mode === 'car' ? 'kgCO2e/vehicle-km' : 'kgCO2e/passenger-km',
        occupants: 1,
      })),
    },
    physicalEvidence: { ios: proof, android: proof },
  };
  return { policy, factors, release };
}
