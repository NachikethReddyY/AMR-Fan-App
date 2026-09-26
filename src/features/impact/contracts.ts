import { z } from 'zod';
// PostgreSQL's text timestamp is not an ECMAScript date format (Hermes rejects
// it). Normalize only the explicit server format, keeping its timezone/instant.
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
const official = z.object({
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
export function parseOfficial(raw: unknown) {
  return z
    .array(official)
    .max(100)
    .parse(raw)
    .map((row) => ({ ...row, id: row.approvalId }));
}
