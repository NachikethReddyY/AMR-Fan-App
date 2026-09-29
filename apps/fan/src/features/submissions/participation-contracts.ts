import { z } from 'zod';

// Network-only mirror; compatibility tests compare the registered server contract.
const uuid = z.uuid();
const sequence = z.string().regex(/^[1-9]\d{0,18}$/);
const total = z.string().regex(/^(0|[1-9]\d*)$/);
const points = z.number().int().min(10).max(2_147_483_647);
export const contributionIntent = z.strictObject({
  submissionId: uuid,
  requestId: uuid,
  points,
});
export const sharedSubmission = z.object({
  id: uuid,
  text: z.string().max(1600),
  tag: z.enum(['question', 'activity', 'other']).nullable(),
  approvedAt: z.iso.datetime(),
  rankingPoints: total,
  status: z.enum(['backlog', 'selected', 'fulfilled']),
  fulfilment: z.literal('demonstration'),
});
export const contributionReceipt = z.object({
  pointsOperationId: uuid,
  submissionId: uuid,
  points,
  rankingPointsAfter: total,
  approvedAt: z.iso.datetime(),
});
export const rankingPage = z
  .object({
    items: z.array(sharedSubmission).max(25),
    nextCursor: z
      .string()
      .min(1)
      .max(1024)
      .regex(/^[A-Za-z0-9_-]+$/)
      .nullable(),
  })
  .refine(
    (page) =>
      new Set(page.items.map((item) => item.id)).size === page.items.length,
  );
export const participationHistoryPage = z
  .object({
    items: z
      .array(
        z
          .object({
            pointsOperationId: uuid,
            sequence,
            submissionId: uuid,
            moderation: z.enum(['pending', 'approved', 'rejected']),
            participation: sharedSubmission.nullable(),
          })
          .refine((row) =>
            row.moderation === 'approved'
              ? row.participation?.id === row.submissionId
              : row.participation === null,
          ),
      )
      .max(25),
    nextCursor: sequence.nullable(),
  })
  .refine(
    (page) =>
      new Set(page.items.map((row) => row.pointsOperationId)).size ===
        page.items.length &&
      (page.nextCursor === null ||
        page.nextCursor === page.items.at(-1)?.sequence),
  );
export type SharedSubmission = z.infer<typeof sharedSubmission>;
export type ContributionIntent = z.infer<typeof contributionIntent>;
