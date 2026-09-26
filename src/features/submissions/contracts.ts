import { z } from 'zod';
export const submissionInput = z.strictObject({
  requestId: z.uuid(),
  text: z
    .string()
    .trim()
    .min(1)
    .max(1600)
    .regex(/^[^\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]+$/u),
  tag: z.enum(['question', 'activity', 'other']).nullable(),
  confirmedFee: z.literal(500),
  resubmissionOf: z.uuid().nullable(),
});
export const submissionSchema = z.object({
  id: z.uuid(),
  sequence: z.string().regex(/^[1-9]\d{0,18}$/),
  ownerProfileId: z.uuid(),
  profileKind: z.enum(['real', 'demo']),
  pointsOperationId: z.uuid(),
  text: z.string().max(1600),
  tag: submissionInput.shape.tag,
  fee: z.literal(500),
  rankingPoints: z.literal(0),
  resubmissionOf: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  status: z.enum(['pending', 'approved', 'rejected']),
  moderatedBy: z.uuid().nullable(),
  moderatedAt: z.iso.datetime().nullable(),
});
export type Submission = z.infer<typeof submissionSchema>;
export type SubmissionInput = z.infer<typeof submissionInput>;
export function ownedSubmission(raw: unknown, id: string) {
  const s = submissionSchema.parse(raw);
  if (s.ownerProfileId !== id) throw new Error('Invalid submission owner.');
  return s;
}
