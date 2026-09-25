import { z } from 'zod';
import { ApiError } from '../accounts/types.ts';

export const SUBMISSION_FEE = 500;
export const uuid = z.uuid().transform((value) => value.toLowerCase());
const submissionInput = z.strictObject({
  requestId: uuid,
  text: z
    .string()
    .trim()
    .min(1)
    .max(1600)
    .regex(/^[^\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]+$/u),
  tag: z.enum(['question', 'activity', 'other']).nullable().default(null),
  confirmedFee: z.literal(SUBMISSION_FEE),
  resubmissionOf: uuid.nullable().default(null),
});

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, 'Invalid submission request.');
  return result.data;
}

export function parseSubmissionInput(value: unknown) {
  return parse(submissionInput, value);
}
