import { z } from 'zod';

const source = z.strictObject({
  text: z.string().min(1).max(1600).regex(/\S/u),
});
const risk = z.enum([
  'targeted-humiliation',
  'harassment',
  'threats',
  'private-data-abuse',
]);
const confidence = z.number().finite().min(0).max(1).nullable().default(null);
const normalized = z.discriminatedUnion('verdict', [
  z.strictObject({
    verdict: z.literal('harmful'),
    risks: z
      .array(risk)
      .min(1)
      .max(4)
      .refine((v) => new Set(v).size === v.length),
    quote: z.string().min(1).max(400).regex(/\S/u),
    confidence,
  }),
  z.strictObject({
    verdict: z.literal('benign'),
    risks: z.array(risk).length(0),
    quote: z.null(),
    confidence,
  }),
  z.strictObject({
    verdict: z.literal('uncertain'),
    risks: z.array(risk).length(0),
    quote: z.null(),
    confidence,
  }),
]);
const failure = z.strictObject({
  kind: z.literal('unavailable'),
  reason: z.enum([
    'disabled',
    'protocol-unverified',
    'invalid-input',
    'invalid-output',
    'timeout',
    'provider',
    'busy',
  ]),
});
type Unavailable = z.infer<typeof failure> & { reviewRequired: true };
export type ModerationResult =
  | Unavailable
  | (Omit<z.infer<typeof normalized>, 'quote'> & {
      kind: 'assessed';
      reviewRequired: true;
      evidence: { quote: string; start: number; end: number } | null;
    });

const unavailable = (reason: Unavailable['reason']): Unavailable => ({
  kind: 'unavailable',
  reason,
  reviewRequired: true,
});

/** No provider I/O until a separately reviewed TokenRouter Jev mapping is verified. */
export function prepareJevModeration(input: unknown): Unavailable {
  return unavailable(
    source.safeParse(input).success ? 'protocol-unverified' : 'invalid-input',
  );
}

/** Internal normalized contract, NOT a claimed TokenRouter/TypeSafe response parser.
 * Structural/source checks cannot prove meaning; every result still needs admin review.
 */
export function validateModerationResult(
  input: unknown,
  result: unknown,
): ModerationResult {
  const parsedSource = source.safeParse(input);
  if (!parsedSource.success) return unavailable('invalid-input');
  const failed = failure.safeParse(result);
  if (failed.success) return unavailable(failed.data.reason);
  const parsed = normalized.safeParse(result);
  if (!parsed.success) return unavailable('invalid-output');
  const { quote, ...assessment } = parsed.data;
  let evidence = null;
  if (quote !== null) {
    const text = parsedSource.data.text;
    const start = text.indexOf(quote);
    if (start < 0 || text.indexOf(quote, start + 1) !== -1)
      return unavailable('invalid-output');
    evidence = { quote, start, end: start + quote.length };
  }
  // Confidence describes the provider distribution only; it never sets verdict or authority.
  return { kind: 'assessed', ...assessment, evidence, reviewRequired: true };
}
