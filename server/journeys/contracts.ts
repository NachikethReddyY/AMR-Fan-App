import { z } from 'zod';
import { ApiError } from '../accounts/types.ts';
import { routeInput } from '../routes/provider.ts';

export const retentionMs = 7 * 24 * 60 * 60 * 1000;
export const id = z.uuid().transform((value) => value.toLowerCase());
export const timestamp = z.number().int().min(0).max(8_640_000_000_000_000);
export const coordinate = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
const mode = z.enum([
  'bus',
  'train',
  'car',
  'electric_car',
  'cab',
  'walk',
  'cycle',
]);
const version = z.string().min(1).max(160);
export const sourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('fixture'),
    label: z.string().min(1).max(160),
  }),
  z.strictObject({
    kind: z.literal('live'),
    provider: z.string().min(1).max(80),
  }),
]);
const routeEvidenceSchema = z.strictObject({
  primaryMode: z.enum(['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE']),
  factorApplicability: z.enum([
    'singapore_indicative',
    'geography_unverified',
    'unsupported_transit_factor',
  ]),
  geographyVersion: version,
});
const evidenceReference = z.strictObject({
  reference: z.string().min(1).max(500),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const co2eFactorEvidenceSchema = evidenceReference.extend({
  boundary: z.literal('use_phase_co2e'),
  baseline: z.literal('single_occupant_ice'),
  compatibility: z.string().min(1).max(2000),
  units: z
    .array(
      z.strictObject({
        factorId: version,
        sourceValue: z.number().nonnegative().max(100),
        sourceUnit: z.enum(['kgCO2e/vehicle-km', 'kgCO2e/passenger-km']),
        occupants: z.number().positive().max(1000),
      }),
    )
    .min(1)
    .max(16),
});
const co2FactorEvidenceSchema = evidenceReference.extend({
  boundary: z.literal('published_surface_access'),
  datasetVersion: z.literal('cag-surface-access-co2-v1'),
  baseline: z.literal('single_occupant_car'),
  gas: z.literal('CO2'),
  unit: z.literal('kgCO2/passenger-km'),
  compatibility: z.string().min(1).max(2000),
  units: z
    .array(
      z.strictObject({
        factorId: version,
        sourceValue: z.number().nonnegative().max(100),
        sourceUnit: z.enum(['kgCO2/vehicle-km', 'kgCO2/passenger-km']),
        publishedUnit: z.enum([
          'kgCO2e/vehicle-km',
          'kgCO2e/passenger-km',
          'kgCO2/passenger-km',
        ]),
        occupants: z.number().positive().max(1000),
      }),
    )
    .min(1)
    .max(16),
});
export const factorEvidenceSchema = z.discriminatedUnion('boundary', [
  co2eFactorEvidenceSchema,
  co2FactorEvidenceSchema,
]);
export const factorReleaseSchema = z.strictObject({
  version,
  factorFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  geographyVersion: version,
  factorEvidence: factorEvidenceSchema,
});
const factorMetadataSchema = z.strictObject({
  id: version,
  mode,
  geography: z.literal('Singapore'),
  period: z.string().min(1).max(160),
  source: z.url().max(2048),
  method: z.string().min(1).max(2000),
  assumptions: z.string().max(2000),
  status: z.enum(['indicative_demo', 'approved']),
});
export const emissionFactorSchema = z.union([
  factorMetadataSchema.extend({
    kgCo2ePerPassengerKm: z.number().nonnegative().max(100),
  }),
  factorMetadataSchema.extend({
    gas: z.literal('CO2'),
    unit: z.literal('kgCO2/passenger-km'),
    kgPerPassengerKm: z.number().nonnegative().max(100),
  }),
]);
export const routeSchema = z.strictObject({
  routeId: z.string().min(1).max(160),
  routeEvidence: routeEvidenceSchema,
  source: sourceSchema,
  fetchedAt: z.iso.datetime(),
  query: routeInput,
  mode,
  start: coordinate,
  end: coordinate,
  points: z.array(coordinate).min(2).max(2048),
  distanceMeters: z.number().positive().max(1_000_000),
  durationSeconds: z.number().positive().max(604800),
  legs: z
    .array(
      z.strictObject({
        mode,
        distanceMeters: z.number().nonnegative().max(1_000_000),
        durationSeconds: z.number().nonnegative().max(604800),
      }),
    )
    .min(1)
    .max(128),
  basis: z.strictObject({
    factorVersions: z.array(version).max(128),
    factorStatus: z.enum(['indicative_demo', 'approved', 'unavailable']),
    factorRelease: factorReleaseSchema.optional(),
    earningRuleVersion: version,
    calculation: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('unavailable'),
        reason: z.string().min(1).max(160),
      }),
      z.strictObject({
        kind: z.literal('available'),
        baseline: z.strictObject({
          routeId: version,
          queryBinding: z.literal('same_server_query'),
          legs: z
            .array(
              z.strictObject({
                mode,
                distanceMeters: z.number().nonnegative().max(1_000_000),
                durationSeconds: z.number().nonnegative().max(604800),
              }),
            )
            .min(1)
            .max(128),
          distanceMeters: z.number().positive().max(1_000_000),
          durationSeconds: z.number().positive().max(604800),
        }),
        factors: z.array(emissionFactorSchema).min(1).max(16),
        earningRule: z.strictObject({
          version,
          pointsPerKg: z.number().nonnegative().max(1000000),
          journeyCap: z.number().int().nonnegative().max(2147483647),
        }),
      }),
    ]),
  }),
});
export type RouteSnapshot = z.infer<typeof routeSchema>;
export const policySchema = z.strictObject({
  version,
  calibration: z.enum(['unvalidated', 'physical_validated']),
  accuracyMeters: z.number().positive().max(50),
  endpointMeters: z.number().positive().max(100),
  endpointFreshnessMs: z.number().int().positive().max(30000),
  corridorMeters: z.number().positive().max(100),
  continuityGapMs: z.number().int().positive().max(120000),
  maxSpeedMpsByMode: z
    .partialRecord(mode, z.number().positive().max(1000))
    .default({}),
});
export const candidatePolicy: z.infer<typeof policySchema> = {
  version: 'journey-calibration-v1',
  calibration: 'unvalidated',
  accuracyMeters: 50,
  endpointMeters: 100,
  endpointFreshnessMs: 30000,
  corridorMeters: 100,
  continuityGapMs: 120000,
  maxSpeedMpsByMode: {},
};
export type EvidencePolicy = z.infer<typeof policySchema>;
export const sampleSchema = z.strictObject({
  id,
  acquiredAtMs: timestamp,
  receivedAtMs: timestamp,
  latitude: coordinate.shape.latitude,
  longitude: coordinate.shape.longitude,
  accuracyMeters: z.number().nonnegative().max(100000).nullable(),
  context: z.enum(['foreground', 'background', 'unknown']),
  mocked: z.boolean().nullable(),
});
export type LocationSample = z.infer<typeof sampleSchema>;
export const storedSampleSchema = z.strictObject({
  evidence: sampleSchema,
  serverReceivedAtMs: timestamp,
});
export const assessmentSchema = z.strictObject({
  version,
  calibration: z.enum(['unvalidated', 'physical_validated']),
  revision: z.number().int().nonnegative(),
  status: z.enum([
    'unfinished',
    'insufficient_evidence',
    'ineligible',
    'satisfies_configured_rules',
    'expired',
  ]),
  reasons: z.array(z.string()),
  startRecorded: z.boolean(),
  arrivalRecorded: z.boolean(),
  sampleCount: z.number().int().nonnegative(),
  elapsedMs: z.number().nonnegative().nullable(),
  observedDistanceMeters: z.number().nonnegative(),
  maxObservedSpeedMps: z.number().nonnegative().nullable(),
  modePlausibility: z.enum([
    'unassessed',
    'consistent_with_configured_speed',
    'inconsistent_with_configured_speed',
  ]),
});
export type Assessment = z.infer<typeof assessmentSchema>;
export const earningPolicy = {
  version: 'initial-50-cap-2000-v1',
  pointsPerKg: 50,
  journeyCap: 2000,
  arithmeticVersion: 'floor-decimal-v1',
} as const;
const earningPolicySchema = z.strictObject({
  version: z.literal(earningPolicy.version),
  pointsPerKg: z.literal(50),
  journeyCap: z.literal(2000),
  arithmeticVersion: z.literal('floor-decimal-v1'),
});
export const assessedLegsSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('available'),
    method: z.literal('gps_single_mode_lower_bound'),
    legs: routeSchema.shape.legs,
  }),
  z.strictObject({
    kind: z.literal('unavailable'),
    reason: z.enum([
      'not_assessed',
      'insufficient_evidence',
      'multimodal_distances_unknown',
    ]),
  }),
]);
// Server deployment evidence, never accepted from journey/settlement HTTP input.
export const awardReleaseSchema = z.strictObject({
  version,
  assessmentEngine: z.literal('journey-assessment-v1'),
  policyFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  factorFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  geographyVersion: version,
  supportedModes: z.array(mode).min(1).max(7),
  distanceMethods: z
    .array(z.literal('gps_single_mode_lower_bound'))
    .min(1)
    .max(1),
  factorEvidence: factorEvidenceSchema,
  physicalEvidence: z.strictObject({
    ios: evidenceReference,
    android: evidenceReference,
  }),
});
export type AwardRelease = z.infer<typeof awardReleaseSchema>;
export const awardPolicySchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('provisional'),
    version: z.literal('planned-endpoints-v1'),
  }),
  z.strictObject({
    kind: z.literal('physical'),
    version: z.literal('assessed-evidence-v1'),
  }),
]);
export const summarySchema = z.strictObject({
  id,
  profileId: id,
  state: z.enum(['prepared', 'active', 'finished']),
  source: sourceSchema,
  mode,
  basis: routeSchema.shape.basis,
  routeEvidence: routeEvidenceSchema,
  selectedLegs: routeSchema.shape.legs,
  assessedLegs: assessedLegsSchema,
  awardRelease: awardReleaseSchema.nullable().optional(),
  awardPolicy: awardPolicySchema.optional(),
  earningPolicy: earningPolicySchema.nullable(),
  policy: policySchema,
  preparedAtMs: timestamp,
  startedAtMs: timestamp.nullable(),
  finishedAtMs: timestamp.nullable(),
  finishReason: z
    .enum([
      'arrival',
      'stopped',
      'permission_revoked',
      'interrupted',
      'abandoned',
    ])
    .nullable(),
  captureSessionId: id.nullable(),
  preciseExpiresAtMs: timestamp,
  evidenceRevision: z.number().int().nonnegative(),
  assessment: assessmentSchema,
});
export type Journey = z.infer<typeof summarySchema>;
// Cursor is a page boundary, never authority; every read still checks the profile owner.
export const journeyListCursorSchema = z.strictObject({
  version: z.literal(1),
  profileId: id,
  view: z.enum(['active', 'recent']),
  preparedAtMs: timestamp,
  id,
});
export const journeyListInput = z.strictObject({
  state: z.literal('active').optional(),
  limit: z
    .union([
      z.number().int().min(1).max(50),
      z
        .string()
        .regex(/^[1-9][0-9]?$/)
        .transform(Number)
        .pipe(z.number().max(50)),
    ])
    .default(20),
  before: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});
export const journeyListItemSchema = summarySchema
  .pick({
    id: true,
    state: true,
    mode: true,
    source: true,
    preparedAtMs: true,
    startedAtMs: true,
    finishedAtMs: true,
    preciseExpiresAtMs: true,
  })
  .extend({
    assessment: assessmentSchema.pick({
      status: true,
      version: true,
      revision: true,
      calibration: true,
    }),
  });
export const journeyListSchema = z.strictObject({
  profileId: id,
  asOfMs: timestamp,
  items: z.array(journeyListItemSchema).max(50),
  nextCursor: journeyListInput.shape.before.unwrap().nullable(),
});
export type JourneyList = z.infer<typeof journeyListSchema>;

export const prepareSchema = z.strictObject({ profileId: id, requestId: id });
export const startSchema = z.strictObject({
  requestId: id,
  captureSessionId: id,
});
export const batchSchema = z.strictObject({
  requestId: id,
  captureSessionId: id,
  samples: z.array(sampleSchema).min(1).max(100),
});
export const finishSchema = z.strictObject({
  requestId: id,
  captureSessionId: id,
  endedAtMs: timestamp,
  reason: summarySchema.shape.finishReason.unwrap(),
});

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, 'Invalid journey input.');
  return result.data;
}
