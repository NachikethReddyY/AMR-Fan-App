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

const submissionFields = {
  id: uuid,
  sequence: z.string().regex(/^[1-9]\d*$/),
  ownerProfileId: uuid,
  profileKind: z.enum(['real', 'demo']),
  pointsOperationId: uuid,
  text: z.string(),
  tag: submissionInput.shape.tag.removeDefault(),
  fee: z.literal(SUBMISSION_FEE),
  rankingPoints: z.literal(0),
  resubmissionOf: uuid.nullable(),
  createdAt: z.iso.datetime(),
};
export const submission = z.discriminatedUnion('status', [
  z.strictObject({
    ...submissionFields,
    status: z.literal('pending'),
    moderatedBy: z.null(),
    moderatedAt: z.null(),
  }),
  z.strictObject({
    ...submissionFields,
    status: z.enum(['approved', 'rejected']),
    moderatedBy: uuid,
    moderatedAt: z.iso.datetime(),
  }),
]);
export type Submission = z.infer<typeof submission>;
export const pageInput = z.strictObject({
  before: z
    .string()
    .regex(/^[1-9]\d{0,18}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const adminPageInput = pageInput.extend({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});
export const decisionInput = z.strictObject({
  requestId: uuid,
  status: z.enum(['approved', 'rejected']),
});

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, 'Invalid submission request.');
  return result.data;
}

export function parseSubmissionInput(value: unknown) {
  return parse(submissionInput, value);
}
