import { z } from 'zod';
import { meaningCues } from './meaning.ts';

// Preserve source whitespace so returned offsets refer to the supplied page.
const text = z.string().min(1).regex(/\S/u);
export const categories = [
  'emissions',
  'energy',
  'water',
  'waste',
  'biodiversity',
  'community',
  'other',
  'unclear',
] as const;
export const tags = ['question', 'activity', 'other', 'unclear'] as const;
export const moderationFlags = ['attention', 'none', 'unclear'] as const;

export const reportSource = z
  .strictObject({
    permission: z.enum(['synthetic', 'permitted']),
    documentId: text.max(100),
    pages: z
      .array(
        z.strictObject({
          page: z.int().min(1).max(10000),
          text: text.max(12000),
        }),
      )
      .min(1)
      .max(8),
  })
  .refine(
    (v) =>
      new Set(v.pages.map((p) => p.page)).size === v.pages.length &&
      v.pages.reduce((n, p) => n + p.text.length, 0) <= 12000,
  );

const field = text.max(160).nullable();
export const extractedCandidate = z.strictObject({
  name: field,
  value: field,
  unit: field,
  period: field,
  category: field,
  meaning: z.enum(meaningCues).nullable(),
  evidence: z.strictObject({ page: z.int().positive(), quote: text.max(1800) }),
});
export const extraction = z.strictObject({
  candidates: z.array(extractedCandidate).max(24),
});
export const fieldNames = [
  'name',
  'value',
  'unit',
  'period',
  'category',
  'meaning',
] as const;
export type Source = z.infer<typeof reportSource>;
export type Extracted = z.infer<typeof extractedCandidate>;
export type Span = { text: string; start: number; end: number };
export type Candidate = {
  fields: Record<(typeof fieldNames)[number], Span | null>;
  missing: (typeof fieldNames)[number][];
  evidence: { page: number; quote: string; start: number; end: number };
};
export type Failure =
  | 'invalid-input'
  | 'disabled'
  | 'busy'
  | 'timeout'
  | 'provider'
  | 'invalid-output'
  | 'ungrounded';
export type Unavailable = {
  kind: 'unavailable';
  reason: Failure;
  reviewRequired: true;
};
export function unavailable(reason: Failure): Unavailable {
  return { kind: 'unavailable', reason, reviewRequired: true };
}

const metric = z.number().finite().min(0).max(100000);
export const calculatedRoute = z
  .strictObject({
    mode: z.enum([
      'bus',
      'train',
      'car',
      'electric car',
      'cab',
      'walking',
      'cycling',
      'mixed',
    ]),
    durationMinutes: metric,
    fastestMinutes: metric,
    toleranceMinutes: metric,
    estimatedKgCO2e: metric,
    baselineKgCO2e: metric,
    avoidedKgCO2e: z.number().finite().min(-100000).max(100000),
    factorVersion: text.max(100),
  })
  .refine(
    (v) =>
      v.durationMinutes >= v.fastestMinutes &&
      v.durationMinutes <= v.fastestMinutes + v.toleranceMinutes,
  );
export type CalculatedRoute = z.infer<typeof calculatedRoute>;
export const submission = z.strictObject({
  text: text.max(1600),
  tag: z.enum(tags).nullable(),
  moderation: z.enum(moderationFlags).nullable(),
});
export const unclassifiedReport = z.strictObject({
  text: text.max(1600),
  category: z.enum(categories).nullable(),
});

export { default as questions } from './questions.json' with { type: 'json' };
