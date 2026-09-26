import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { awardProjection } from './testing/fixtures.ts';
import { calculateJourneyAward } from './policy.ts';
import {
  fingerprint,
  loadAwardRelease,
  loadFactorRelease,
} from './readiness.ts';

// Explicit synthetic authority fixture, not an approved dataset or field report.
function released() {
  const journey = awardProjection();
  assert.ok(journey.basis.calculation.kind === 'available');
  journey.source = { kind: 'live', provider: 'synthetic-test' };
  journey.policy.maxSpeedMpsByMode = { bus: 30 };
  journey.policy.calibration = 'physical_validated';
  journey.assessment.calibration = 'physical_validated';
  journey.assessment.modePlausibility = 'consistent_with_configured_speed';
  journey.basis.factorStatus = 'approved';
  for (const factor of journey.basis.calculation.factors)
    factor.status = 'approved';
  const proof = { reference: 'synthetic-test-only', sha256: 'a'.repeat(64) };
  journey.awardRelease = {
    version: 'synthetic-test-release-v1',
    assessmentEngine: 'journey-assessment-v1',
    policyFingerprint: fingerprint(journey.policy),
    factorFingerprint: fingerprint(journey.basis.calculation.factors),
    geographyVersion: journey.routeEvidence.geographyVersion,
    supportedModes: ['bus'],
    distanceMethods: ['gps_single_mode_lower_bound'],
    factorEvidence: {
      ...proof,
      boundary: 'use_phase_co2e',
      baseline: 'single_occupant_ice',
      compatibility: 'Synthetic arithmetic only; not field evidence.',
      units: journey.basis.calculation.factors.map((f) => ({
        factorId: f.id,
        sourceValue: f.kgCo2ePerPassengerKm,
        sourceUnit:
          f.mode === 'car' ? 'kgCO2e/vehicle-km' : 'kgCO2e/passenger-km',
        occupants: 1,
      })),
    },
    physicalEvidence: { ios: proof, android: proof },
  };
  return journey;
}

test('readiness is reachable for a retained, bound release; default and mismatches fail closed', () => {
  assert.equal(
    calculateJourneyAward(released()).productionCredit.kind,
    'ready',
  );
  for (const mutate of [
    (j: ReturnType<typeof released>) => {
      j.awardRelease = null;
    },
    (j: ReturnType<typeof released>) => {
      j.source = { kind: 'fixture', label: 'test' };
    },
    (j: ReturnType<typeof released>) => {
      j.policy.endpointMeters = 99;
    },
    (j: ReturnType<typeof released>) => {
      j.assessment.calibration = 'unvalidated';
    },
    (j: ReturnType<typeof released>) => {
      j.assessment.modePlausibility = 'unassessed';
    },
    (j: ReturnType<typeof released>) => {
      j.routeEvidence.geographyVersion = 'unknown';
    },
    (j: ReturnType<typeof released>) => {
      if (j.basis.calculation.kind === 'available')
        j.basis.calculation.factors[0].kgCo2ePerPassengerKm += 1;
    },
  ]) {
    const journey = released();
    mutate(journey);
    assert.equal(
      calculateJourneyAward(journey).productionCredit.kind,
      'unavailable',
    );
  }
});

test('released fallback still requires both endpoints and never supplies full assessed emissions', () => {
  const journey = released();
  journey.assessment.status = 'insufficient_evidence';
  journey.assessment.reasons = ['continuity_gap'];
  journey.assessedLegs = {
    kind: 'unavailable',
    reason: 'insufficient_evidence',
  };
  const result = calculateJourneyAward(journey);
  assert.equal(result.productionCredit.kind, 'ready');
  assert.equal(result.decision.kind, 'fallback');
  journey.assessment.startRecorded = false;
  assert.equal(
    calculateJourneyAward(journey).productionCredit.kind,
    'unavailable',
  );
});

test('release loader requires actual local evidence bytes, matching policy and factors, not an enable flag', () => {
  const directory = mkdtempSync(join(tmpdir(), 'amr-award-release-'));
  try {
    const journey = released();
    assert.ok(
      journey.basis.calculation.kind === 'available' && journey.awardRelease,
    );
    const bytes = 'SYNTHETIC loader evidence; no physical proof';
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const proof = { reference: 'synthetic-test-only', sha256 };
    const release = {
      ...journey.awardRelease,
      factorEvidence: { ...journey.awardRelease.factorEvidence, ...proof },
      physicalEvidence: { ios: proof, android: proof },
    };
    writeFileSync(join(directory, 'proof.txt'), bytes);
    const config = {
      policy: journey.policy,
      factors: journey.basis.calculation.factors,
      release,
      evidenceFiles: {
        factors: 'proof.txt',
        ios: 'proof.txt',
        android: 'proof.txt',
      },
    };
    for (const platform of ['ios', 'android'] as const) {
      const report = JSON.stringify({
        kind: 'physical_field_validation',
        platform,
        device: 'SYNTHETIC fixture, not physical evidence',
        osVersion: 'test',
        appBuild: 'test',
        testedAt: '2026-09-26T00:00:00.000Z',
        policyFingerprint: release.policyFingerprint,
        assessmentEngine: 'journey-assessment-v1',
        supportedModes: ['bus'],
        distanceMethods: ['gps_single_mode_lower_bound'],
        outcome: 'accepted',
        findings: 'Synthetic parser test only.',
      });
      const name = `${platform}.json`;
      writeFileSync(join(directory, name), report);
      config.evidenceFiles[platform] = name;
      config.release.physicalEvidence[platform] = {
        reference: 'synthetic-test-only',
        sha256: createHash('sha256').update(report).digest('hex'),
      };
    }
    const path = join(directory, 'release.json');
    writeFileSync(path, JSON.stringify(config));
    assert.equal(loadAwardRelease(path)?.release.version, release.version);
    for (const change of [
      (c: typeof config) => {
        c.policy.accuracyMeters = 49;
      },
      (c: typeof config) => {
        c.factors[0].kgCo2ePerPassengerKm = 9;
      },
      (c: typeof config) => {
        c.release.supportedModes = ['train'];
      },
      (c: typeof config) => {
        c.evidenceFiles.android = 'ios.json';
        c.release.physicalEvidence.android = c.release.physicalEvidence.ios;
      },
    ]) {
      const invalid = structuredClone(config);
      change(invalid);
      writeFileSync(path, JSON.stringify(invalid));
      assert.throws(() => loadAwardRelease(path));
    }
    const wrongUnit = structuredClone(config);
    wrongUnit.release.factorEvidence.units[0].sourceUnit =
      'kgCO2e/passenger-km';
    writeFileSync(path, JSON.stringify(wrongUnit));
    assert.throws(() => loadAwardRelease(path), /single-driver/);
    writeFileSync(path, JSON.stringify(config));
    const ios = join(directory, 'ios.json');
    const saved = readFileSync(ios, 'utf8');
    const simulator = saved.replace(
      'physical_field_validation',
      'simulator_validation',
    );
    writeFileSync(ios, simulator);
    config.release.physicalEvidence.ios.sha256 = createHash('sha256')
      .update(simulator)
      .digest('hex');
    writeFileSync(path, JSON.stringify(config));
    assert.throws(() => loadAwardRelease(path));
    writeFileSync(ios, saved);
    config.release.physicalEvidence.ios.sha256 = createHash('sha256')
      .update(saved)
      .digest('hex');
    writeFileSync(path, JSON.stringify(config));
    writeFileSync(join(directory, 'proof.txt'), 'changed');
    assert.throws(() => loadAwardRelease(path), /evidence/i);
    assert.equal(loadAwardRelease(undefined), null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('release refuses unreviewed single-driver conversion and unsupported modes', () => {
  const journey = released();
  assert.ok(journey.awardRelease);
  journey.awardRelease.supportedModes = ['walk'];
  assert.equal(
    calculateJourneyAward(journey).productionCredit.kind,
    'unavailable',
  );
  journey.awardRelease.supportedModes = ['bus'];
  journey.assessedLegs = {
    kind: 'available',
    method: 'gps_single_mode_lower_bound',
    legs: [{ mode: 'cab', distanceMeters: 100, durationSeconds: 10 }],
  };
  assert.equal(
    calculateJourneyAward(journey).productionCredit.kind,
    'unavailable',
  );
});

test('legacy unavailable readiness is stable for immutable receipts across upgrade', () => {
  assert.deepEqual(calculateJourneyAward(awardProjection()).productionCredit, {
    kind: 'unavailable',
    reasons: [
      'calibration_unvalidated',
      'synthetic_journey',
      'factors_not_approved',
      'production_factor_applicability_unavailable',
    ],
  });
});

test('an approved status or live label without retained release never enables production credit', () => {
  const journey = released();
  delete journey.awardRelease;
  const result = calculateJourneyAward(journey);
  assert.equal(result.decision.kind, 'full');
  assert.equal(result.productionCredit.kind, 'unavailable');
});

function provisional() {
  const journey = released();
  assert.ok(journey.awardRelease);
  journey.awardPolicy = {
    kind: 'provisional',
    version: 'planned-endpoints-v1',
  };
  journey.basis.factorRelease = {
    version: 'synthetic-factor-release-v1',
    factorFingerprint: journey.awardRelease.factorFingerprint,
    geographyVersion: journey.awardRelease.geographyVersion,
    factorEvidence: journey.awardRelease.factorEvidence,
  };
  journey.awardRelease = null;
  journey.policy.calibration = 'unvalidated';
  journey.assessment.calibration = 'unvalidated';
  journey.assessment.modePlausibility = 'unassessed';
  return journey;
}

test('approved provisional policy uses retained plan and exposes assessed estimate separately without physical approval', () => {
  const journey = provisional();
  assert.ok(journey.basis.calculation.kind === 'available');
  journey.basis.calculation.factors[1].kgCo2ePerPassengerKm = 0.1;
  assert.ok(journey.basis.factorRelease);
  journey.basis.factorRelease.factorFingerprint = fingerprint(
    journey.basis.calculation.factors,
  );
  journey.selectedLegs = [
    { mode: 'bus', distanceMeters: 2000, durationSeconds: 300 },
  ];
  journey.assessedLegs = {
    kind: 'available',
    method: 'gps_single_mode_lower_bound',
    legs: [{ mode: 'bus', distanceMeters: 1000, durationSeconds: 300 }],
  };
  const result = calculateJourneyAward(journey);
  assert.ok(result.decision.kind === 'provisional');
  assert.equal(result.decision.calculation.targetPoints, 110);
  assert.equal(result.decision.assessedCalculation?.targetPoints, 115);
  assert.equal(result.productionCredit.kind, 'provisional');
  journey.assessedLegs = {
    kind: 'unavailable',
    reason: 'multimodal_distances_unknown',
  };
  const unknown = calculateJourneyAward(journey);
  assert.ok(unknown.decision.kind === 'provisional');
  assert.equal(unknown.decision.assessedCalculation, null);
  assert.equal(unknown.decision.calculation.targetPoints, 110);
});

test('provisional endpoints, approved factors and missing-middle fallback retain accepted boundaries', () => {
  const journey = provisional();
  journey.assessment.status = 'insufficient_evidence';
  journey.assessment.reasons = ['continuity_gap'];
  const fallback = calculateJourneyAward(journey);
  assert.ok(fallback.decision.kind === 'fallback');
  assert.equal(fallback.decision.targetPoints, 50);
  assert.equal(fallback.productionCredit.kind, 'provisional');
  for (const endpoint of ['startRecorded', 'arrivalRecorded'] as const) {
    journey.assessment[endpoint] = false;
    assert.equal(
      calculateJourneyAward(journey).productionCredit.kind,
      'unavailable',
    );
    journey.assessment[endpoint] = true;
  }
  journey.basis.factorStatus = 'indicative_demo';
  assert.equal(
    calculateJourneyAward(journey).productionCredit.kind,
    'unavailable',
  );
});

test('independent factor release validates the same units and provenance without a physical report', () => {
  const directory = mkdtempSync(join(tmpdir(), 'amr-factor-release-'));
  try {
    const journey = provisional();
    assert.ok(
      journey.basis.factorRelease &&
        journey.basis.calculation.kind === 'available',
    );
    const proof = 'Synthetic factor-review fixture, not source approval.';
    const config = {
      factors: journey.basis.calculation.factors,
      release: journey.basis.factorRelease,
      evidenceFile: 'review.txt',
    };
    config.release.factorEvidence.sha256 = createHash('sha256')
      .update(proof)
      .digest('hex');
    writeFileSync(join(directory, 'review.txt'), proof);
    const path = join(directory, 'factors.json');
    writeFileSync(path, JSON.stringify(config));
    assert.equal(
      loadFactorRelease(path)?.release.version,
      config.release.version,
    );
    assert.equal(loadFactorRelease(undefined), null);
    for (const change of [
      (c: typeof config) => {
        c.release.factorEvidence.units[0].sourceUnit = 'kgCO2e/passenger-km';
      },
      (c: typeof config) => {
        c.release.factorEvidence.units[0].occupants = 2;
      },
      (c: typeof config) => {
        c.release.factorFingerprint = '0'.repeat(64);
      },
      (c: typeof config) => {
        c.factors[0].status = 'indicative_demo';
      },
      (c: typeof config) => {
        c.release.factorEvidence.units[1].sourceValue += 1;
      },
    ]) {
      const invalid = structuredClone(config);
      change(invalid);
      writeFileSync(path, JSON.stringify(invalid));
      assert.throws(() => loadFactorRelease(path));
    }
    writeFileSync(path, JSON.stringify(config));
    writeFileSync(join(directory, 'review.txt'), 'changed');
    assert.throws(() => loadFactorRelease(path), /digest/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('provisional policy fails closed for missing approval, changed geography, invalid evidence and unsupported factors', () => {
  for (const change of [
    (j: ReturnType<typeof provisional>) => {
      delete j.basis.factorRelease;
    },
    (j: ReturnType<typeof provisional>) => {
      j.routeEvidence.geographyVersion = 'unknown';
    },
    (j: ReturnType<typeof provisional>) => {
      j.source = { kind: 'fixture', label: 'test' };
    },
    (j: ReturnType<typeof provisional>) => {
      j.assessment.status = 'ineligible';
    },
    (j: ReturnType<typeof provisional>) => {
      j.selectedLegs[0].mode = 'cab';
    },
    (j: ReturnType<typeof provisional>) => {
      j.finishedAtMs = j.startedAtMs;
    },
  ]) {
    const journey = provisional();
    change(journey);
    assert.equal(
      calculateJourneyAward(journey).productionCredit.kind,
      'unavailable',
    );
  }
});

test('provisional whole-point boundaries, journey cap and fallback ceiling use the retained rule', () => {
  for (const [kg, expected] of [
    [0.0199, 0],
    [2.419, 120],
    [10, 500],
    [60, 2000],
  ]) {
    const journey = provisional();
    assert.ok(
      journey.basis.calculation.kind === 'available' &&
        journey.basis.factorRelease,
    );
    journey.basis.calculation.factors[0].kgCo2ePerPassengerKm = kg;
    journey.basis.factorRelease.factorFingerprint = fingerprint(
      journey.basis.calculation.factors,
    );
    const result = calculateJourneyAward(journey);
    assert.ok(result.decision.kind === 'provisional');
    assert.equal(result.decision.calculation.targetPoints, expected);
    journey.assessment.status = 'insufficient_evidence';
    journey.assessment.reasons = ['continuity_gap'];
    const fallback = calculateJourneyAward(journey);
    assert.ok(fallback.decision.kind === 'fallback');
    assert.equal(fallback.decision.targetPoints, Math.min(50, expected));
  }
});
