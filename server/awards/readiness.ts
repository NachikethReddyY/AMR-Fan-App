import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import {
  awardReleaseSchema,
  factorReleaseSchema,
  policySchema,
  routeSchema,
} from '../journeys/contracts.ts';
import type { JourneySettlementProjection } from '../journeys/settlement.ts';
import type { PolicyResult } from './contracts.ts';
import { decimal, decimalString, multiply } from './decimal.ts';

// Canonical object order makes hashes independent of JSON formatting/key order.
export function fingerprint(value: unknown): string {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical);
    if (input !== null && typeof input === 'object')
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, item]) => [key, canonical(item)]),
      );
    return input;
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
const factorsSchema =
  routeSchema.shape.basis.shape.calculation.options[1].shape.factors;
const releaseFileSchema = z.strictObject({
  policy: policySchema,
  factors: factorsSchema,
  release: awardReleaseSchema,
  evidenceFiles: z.strictObject({
    factors: z.string().min(1),
    ios: z.string().min(1),
    android: z.string().min(1),
  }),
});
export const physicalReportSchema = z.strictObject({
  kind: z.literal('physical_field_validation'),
  platform: z.enum(['ios', 'android']),
  device: z.string().min(1).max(160),
  osVersion: z.string().min(1).max(80),
  appBuild: z.string().min(1).max(160),
  testedAt: z.iso.datetime(),
  policyFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  assessmentEngine: z.literal('journey-assessment-v1'),
  supportedModes: awardReleaseSchema.shape.supportedModes,
  distanceMethods: awardReleaseSchema.shape.distanceMethods,
  outcome: z.literal('accepted'),
  findings: z.string().min(1).max(10000),
});
function readBounded(path: string) {
  if (statSync(path).size > 1024 * 1024)
    throw new Error('Award evidence file exceeds 1 MiB.');
  return readFileSync(path);
}
const factorFileSchema = z.strictObject({
  factors: factorsSchema,
  release: factorReleaseSchema,
  evidenceFile: z.string().min(1),
});
function validateFactors(
  factors: z.infer<typeof factorsSchema>,
  release: z.infer<typeof factorReleaseSchema>,
) {
  if (fingerprint(factors) !== release.factorFingerprint)
    throw new Error('Factor release evidence binding mismatch.');
  if (
    factors.some((f) => f.status !== 'approved') ||
    new Set(factors.map((f) => f.mode)).size !== factors.length ||
    new Set(factors.map((f) => f.id)).size !== factors.length ||
    !factors.some((f) => f.mode === 'car')
  )
    throw new Error(
      'Award release requires unique approved factors and a car baseline.',
    );
  for (const factor of factors) {
    const units = release.factorEvidence.units.filter(
      (unit) => unit.factorId === factor.id,
    );
    const unit = units[0];
    if (
      units.length !== 1 ||
      !unit ||
      (unit.sourceUnit === 'kgCO2e/passenger-km' && unit.occupants !== 1) ||
      decimalString(decimal(unit.sourceValue)) !==
        decimalString(
          multiply(
            decimal(factor.kgCo2ePerPassengerKm),
            decimal(
              unit.sourceUnit === 'kgCO2e/vehicle-km' ? unit.occupants : 1,
            ),
          ),
        ) ||
      (factor.mode === 'car' &&
        (unit.sourceUnit !== 'kgCO2e/vehicle-km' || unit.occupants !== 1))
    )
      throw new Error(
        'Award factor unit conversion or single-driver baseline evidence is invalid.',
      );
  }
}
export function loadFactorRelease(path: string | undefined) {
  if (!path) return null;
  const config = factorFileSchema.parse(
    JSON.parse(readBounded(path).toString('utf8')),
  );
  validateFactors(config.factors, config.release);
  const bytes = readBounded(resolve(dirname(path), config.evidenceFile));
  if (
    createHash('sha256').update(bytes).digest('hex') !==
    config.release.factorEvidence.sha256
  )
    throw new Error('Factor release evidence digest mismatch.');
  return { factors: config.factors, release: config.release };
}

// Trusted deployer-owned file, not an HTTP route or client-controlled environment.
// Hashes prove retention/integrity, not the truth of the reviewer’s field findings.
export function loadAwardRelease(path: string | undefined) {
  if (!path) return null;
  const config = releaseFileSchema.parse(
    JSON.parse(readBounded(path).toString('utf8')),
  );
  const { release, policy, factors } = config;
  if (
    policy.calibration !== 'physical_validated' ||
    fingerprint(policy) !== release.policyFingerprint ||
    fingerprint(factors) !== release.factorFingerprint
  )
    throw new Error('Award release policy/factor evidence binding mismatch.');
  validateFactors(factors, release);
  for (const mode of release.supportedModes)
    if (
      !factors.some((f) => f.mode === mode) ||
      policy.maxSpeedMpsByMode[mode] === undefined
    )
      throw new Error(
        'Award release mode lacks factor or calibrated plausibility bound.',
      );
  for (const key of ['factors', 'ios', 'android'] as const) {
    const evidence =
      key === 'factors'
        ? release.factorEvidence
        : release.physicalEvidence[key];
    const bytes = readBounded(
      resolve(dirname(path), config.evidenceFiles[key]),
    );
    if (createHash('sha256').update(bytes).digest('hex') !== evidence.sha256)
      throw new Error(`Award release ${key} evidence digest mismatch.`);
    if (key !== 'factors') {
      const report = physicalReportSchema.parse(
        JSON.parse(bytes.toString('utf8')),
      );
      if (
        report.platform !== key ||
        report.policyFingerprint !== release.policyFingerprint ||
        release.distanceMethods.some(
          (method) => !report.distanceMethods.includes(method),
        ) ||
        release.supportedModes.some(
          (mode) => !report.supportedModes.includes(mode),
        )
      )
        throw new Error(
          'Physical evidence does not cover the released platform, policy or modes.',
        );
    }
  }
  return { policy, factors, release };
}

export function productionReadiness(
  journey: JourneySettlementProjection,
  decision: PolicyResult['decision'],
): PolicyResult['productionCredit'] {
  const reasons: string[] = [];
  const release = journey.awardRelease;
  if (journey.awardPolicy?.kind === 'provisional') {
    const factorRelease = journey.basis.factorRelease;
    if (journey.source.kind !== 'live') reasons.push('synthetic_journey');
    if (journey.basis.factorStatus !== 'approved')
      reasons.push('factors_not_approved');
    if (
      !factorRelease ||
      journey.basis.calculation.kind !== 'available' ||
      fingerprint(journey.basis.calculation.factors) !==
        factorRelease.factorFingerprint
    )
      reasons.push('factor_release_mismatch');
    if (
      journey.routeEvidence.factorApplicability !== 'singapore_indicative' ||
      journey.routeEvidence.geographyVersion !== factorRelease?.geographyVersion
    )
      reasons.push('factor_applicability_unavailable');
    if (decision.kind !== 'provisional' && decision.kind !== 'fallback')
      reasons.push('eligible_calculation_unavailable');
    return reasons.length || !factorRelease
      ? { kind: 'unavailable', reasons }
      : {
          kind: 'provisional',
          policyVersion: journey.awardPolicy.version,
          factorReleaseVersion: factorRelease.version,
        };
  }
  // Preserve the result of pre-release receipts byte-for-byte after upgrades.
  // A new deploy cannot retroactively release an already-started journey.
  if (!release) {
    const legacy = ['calibration_unvalidated'];
    if (journey.source.kind === 'fixture') legacy.push('synthetic_journey');
    if (journey.basis.factorStatus !== 'approved')
      legacy.push('factors_not_approved');
    legacy.push('production_factor_applicability_unavailable');
    return { kind: 'unavailable', reasons: legacy };
  }
  if (journey.source.kind !== 'live') reasons.push('synthetic_journey');
  if (
    journey.policy.calibration !== 'physical_validated' ||
    journey.assessment.calibration !== 'physical_validated'
  )
    reasons.push('calibration_unvalidated');
  if (journey.basis.factorStatus !== 'approved')
    reasons.push('factors_not_approved');
  if (journey.routeEvidence.factorApplicability !== 'singapore_indicative')
    reasons.push('factor_applicability_unavailable');
  if (decision.kind !== 'full' && decision.kind !== 'fallback')
    reasons.push('eligible_calculation_unavailable');
  if (fingerprint(journey.policy) !== release.policyFingerprint)
    reasons.push('calibration_policy_mismatch');
  if (
    journey.basis.calculation.kind !== 'available' ||
    fingerprint(journey.basis.calculation.factors) !== release.factorFingerprint
  )
    reasons.push('factor_release_mismatch');
  if (journey.routeEvidence.geographyVersion !== release.geographyVersion)
    reasons.push('geography_version_unsupported');
  const modes = new Set(journey.selectedLegs.map((leg) => leg.mode));
  if (journey.assessedLegs.kind === 'available')
    for (const leg of journey.assessedLegs.legs) modes.add(leg.mode);
  if (
    [...modes].some(
      (mode) =>
        !release.supportedModes.includes(mode) ||
        journey.policy.maxSpeedMpsByMode[mode] === undefined,
    )
  )
    reasons.push('mode_not_calibrated');
  if (
    decision.kind === 'full' &&
    (journey.assessedLegs.kind !== 'available' ||
      !release.distanceMethods.includes(journey.assessedLegs.method))
  )
    reasons.push('distance_method_not_validated');
  // Missing middle evidence may have no usable speed; that is the accepted fallback.
  if (
    decision.kind === 'full' &&
    journey.assessment.modePlausibility !== 'consistent_with_configured_speed'
  )
    reasons.push('mode_plausibility_unassessed');
  return reasons.length
    ? { kind: 'unavailable', reasons }
    : {
        kind: 'ready',
        version: 'journey-award-readiness-v1',
        releaseVersion: release.version,
      };
}
