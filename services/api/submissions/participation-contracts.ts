import { z } from 'zod';
import { points, reason } from '../points/contracts.ts';
import { uuid } from './contracts.ts';

export const rankingPoints = z.string().regex(/^(0|[1-9]\d*)$/);
const contributionPoints = points.refine((value) => value >= 10);
export const contributionInput = z.strictObject({
  requestId: uuid,
  points: contributionPoints,
});
export const sessionInput = z.strictObject({ requestId: uuid });
export const resolutionInput = z.strictObject({
  requestId: uuid,
  action: z.enum(['release', 'fulfil']),
  reason,
});
export const contributionReceipt = z.strictObject({
  pointsOperationId: uuid,
  submissionId: uuid,
  points: contributionPoints,
  rankingPointsAfter: rankingPoints,
  approvedAt: z.iso.datetime(),
});
export const rankingCursor = z.strictObject({
  points: rankingPoints,
  approvedAt: z.iso.datetime(),
  sequence: z.string().regex(/^[1-9]\d{0,18}$/),
});
export const rankingQuery = z.strictObject({
  after: z
    .string()
    .min(1)
    .max(1024)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const sharedSubmission = z.strictObject({
  id: uuid,
  text: z.string(),
  tag: z.enum(['question', 'activity', 'other']).nullable(),
  approvedAt: z.iso.datetime(),
  rankingPoints,
  status: z.enum(['backlog', 'selected', 'fulfilled']),
  fulfilment: z.literal('demonstration'),
});
export const selectionSnapshot = z.strictObject({
  id: uuid,
  sessionId: uuid,
  submissionId: uuid,
  rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  rankingPointsAtClose: rankingPoints,
  approvedAt: z.iso.datetime(),
  selectedAt: z.iso.datetime(),
});
export const selection = z.discriminatedUnion('status', [
  selectionSnapshot.extend({ status: z.literal('selected') }),
  selectionSnapshot.extend({
    status: z.enum(['released', 'fulfilled']),
    resolvedBy: uuid,
    resolvedAt: z.iso.datetime(),
    reason,
    fulfilment: z.literal('demonstration'),
  }),
]);
const sessionFields = {
  id: uuid,
  sequence: z.string().regex(/^[1-9]\d*$/),
  createdBy: uuid,
  createdAt: z.iso.datetime(),
};
export const openSession = z.strictObject({
  ...sessionFields,
  state: z.literal('open'),
});
export const closedSession = z.strictObject({
  ...sessionFields,
  state: z.literal('closed'),
  closedBy: uuid,
  closedAt: z.iso.datetime(),
  selections: z.array(selectionSnapshot).max(3),
});
export const interactionSession = z.discriminatedUnion('state', [
  openSession,
  closedSession,
]);
export const historyParticipation = z.strictObject({
  pointsOperationId: uuid,
  sequence: z.string().regex(/^[1-9]\d*$/),
  submissionId: uuid,
  moderation: z.enum(['pending', 'approved', 'rejected']),
  participation: sharedSubmission.nullable(),
});
