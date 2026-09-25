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
    policy: candidatePolicy,
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
