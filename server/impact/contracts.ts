import { z } from 'zod';

export const impactReason = z.enum([
  'demo_profile',
  'validation_pending',
  'factors_unapproved',
  'insufficient_evidence',
  'calculation_unavailable',
  'assessment_pending',
]);
const exactKg = z
  .string()
  .max(1000)
  .regex(/^(0|[1-9]\d*)(\.\d+)?$/);
export const impactTotal = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('empty') }),
  z.strictObject({
    kind: z.literal('unavailable'),
    reasons: z.array(impactReason).min(1).max(6),
  }),
  z.strictObject({
    kind: z.literal('available'),
    savingsKg: exactKg,
    journeyCount: z.number().int().positive().safe(),
    excludedJourneys: z.number().int().nonnegative().safe(),
  }),
]);
export const impactSource = z.strictObject({
  id: z.string().min(1).max(160),
  source: z.url().max(2048),
  period: z.string().min(1).max(160),
  method: z.string().min(1).max(2000),
  assumptions: z.string().max(2000),
});
export const contributionsSchema = z.strictObject({
  period: z.literal('lifetime'),
  unit: z.literal('kgCO2e'),
  personal: impactTotal,
  community: impactTotal,
  sources: z.array(impactSource).max(100),
  validation: z
    .array(z.enum(['reviewed_release', 'unvalidated_estimate']))
    .max(2),
});
export type ImpactTotal = z.infer<typeof impactTotal>;
export type ImpactSource = z.infer<typeof impactSource>;
export type Contributions = z.infer<typeof contributionsSchema>;
