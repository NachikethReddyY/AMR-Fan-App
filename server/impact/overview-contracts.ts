import { z } from 'zod';
import { contributionsSchema, impactTotal } from './contracts.ts';

const approvalTime = z
  .string()
  .transform((value) => {
    const match =
      /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?([+-]\d{2})(:\d{2})?$/.exec(
        value,
      );
    if (!match) return value;
    const [, date, time, fraction = '', hour, minute = ':00'] = match;
    return `${date}T${time}.${fraction.padEnd(3, '0').slice(0, 3)}${hour}${minute}`;
  })
  .pipe(z.iso.datetime({ offset: true }))
  .refine((value) => Number.isFinite(Date.parse(value)));

const span = z.object({
  text: z.string().min(1).max(500),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export const officialReportSchema = z.object({
  approvalId: z.uuid(),
  candidateId: z.uuid(),
  documentId: z.uuid(),
  title: z.string().min(1).max(160),
  sourceKind: z.enum(['synthetic', 'permitted']),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  parserVersion: z.string().min(1).max(200),
  reviewerId: z.uuid(),
  approvedAt: approvalTime,
  fields: z.object({
    name: span,
    value: span,
    unit: span,
    period: span,
    category: span.nullable(),
    meaning: span,
    method: span.nullable(),
  }),
  evidence: z.object({
    page: z.number().int().min(1).max(100),
    quote: z.string().min(1).max(1800),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  }),
  missing: z
    .array(
      z.enum([
        'name',
        'value',
        'unit',
        'period',
        'category',
        'meaning',
        'method',
      ]),
    )
    .max(7),
  period: z.string().nullable(),
});
export const officialMetricSchema = officialReportSchema.extend({
  id: z.uuid(),
});
export type OfficialReport = z.infer<typeof officialReportSchema>;
export type OfficialMetric = z.infer<typeof officialMetricSchema>;

export function parseOfficial(raw: unknown): OfficialMetric[] {
  return z
    .array(officialReportSchema)
    .max(100)
    .parse(raw)
    .map((row) => ({ ...row, id: row.approvalId }));
}

export const overviewReason = z.enum(['demo_profile', 'source_unavailable']);
export const overviewImpactTotal = z.discriminatedUnion('kind', [
  impactTotal.options[0],
  impactTotal.options[1].extend({
    reasons: z
      .array(
        z.union([
          z.enum([
            'demo_profile',
            'validation_pending',
            'factors_unapproved',
            'insufficient_evidence',
            'calculation_unavailable',
            'assessment_pending',
            'incompatible_measurement',
          ]),
          z.literal('source_unavailable'),
        ]),
      )
      .min(1)
      .max(7),
  }),
  impactTotal.options[2],
]);
export type OverviewImpactTotal = z.infer<typeof overviewImpactTotal>;

const participationAvailable = z.strictObject({
  kind: z.literal('available'),
  activityCount: z.number().int().nonnegative().safe(),
  missionsCompleted: z.number().int().nonnegative().safe(),
});
const personalParticipation = z.discriminatedUnion('kind', [
  participationAvailable.extend({
    pointsEarned: z.number().int().nonnegative().safe(),
  }),
  z.strictObject({
    kind: z.literal('unavailable'),
    reason: z.enum(['demo_profile', 'source_unavailable']),
  }),
]);
const communityParticipation = z.discriminatedUnion('kind', [
  participationAvailable,
  z.strictObject({
    kind: z.literal('unavailable'),
    reason: z.literal('source_unavailable'),
  }),
]);

export const travelMethodology = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('available'),
    period: contributionsSchema.shape.period,
    unit: contributionsSchema.shape.unit,
    sources: contributionsSchema.shape.sources,
    validation: contributionsSchema.shape.validation,
  }),
  z.strictObject({
    kind: z.literal('unavailable'),
    reason: z.literal('source_unavailable'),
  }),
]);

export const methodologyRecord = z.strictObject({
  label: z.string().min(1).max(160),
  unit: z.string().max(160).nullable(),
  period: z.string().max(160).nullable(),
  method: z.string().max(2000).nullable(),
  assumptions: z.string().max(2000).nullable(),
  source: z.string().max(2048).nullable(),
});

export const impactOverviewSchema = z.strictObject({
  official: z.discriminatedUnion('status', [
    z.strictObject({
      status: z.literal('available'),
      metrics: z.array(officialMetricSchema).max(100),
    }),
    z.strictObject({
      status: z.literal('empty'),
      metrics: z.array(officialMetricSchema).length(0),
    }),
    z.strictObject({
      status: z.literal('unavailable'),
      metrics: z.array(officialMetricSchema).length(0),
      reason: z.literal('source_unavailable'),
    }),
  ]),
  fan: z.strictObject({
    personal: z.strictObject({
      participation: personalParticipation,
      travel: overviewImpactTotal,
    }),
    community: z.strictObject({
      participation: communityParticipation,
      travel: overviewImpactTotal,
    }),
  }),
  travelMethodology,
  methodology: z.array(methodologyRecord).max(103),
});
export type ImpactOverview = z.infer<typeof impactOverviewSchema>;
export function parseOverview(raw: unknown): ImpactOverview {
  return impactOverviewSchema.parse(raw);
}
export type PersonalParticipation = z.infer<typeof personalParticipation>;
export type CommunityParticipation = z.infer<typeof communityParticipation>;
