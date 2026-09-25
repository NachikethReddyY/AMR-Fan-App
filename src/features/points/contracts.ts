import { z } from 'zod';

const points = z.number().int().min(0).max(2_147_483_647);
const sequence = z.string().regex(/^[1-9]\d{0,18}$/);
const entry = z.object({
  id: z.uuid(),
  sequence,
  profileId: z.uuid(),
  actorId: z.uuid(),
  kind: z.string().min(1).max(80),
  delta: z.number().int().min(-2_147_483_647).max(2_147_483_647),
  balanceAfter: points,
  reason: z.string().min(1).max(500),
  recordedAt: z.iso.datetime(),
});
const historyPage = z.object({
  profile: z.object({
    id: z.uuid(),
    kind: z.enum(['real', 'demo']),
    displayName: z.string().max(80),
    balance: points,
  }),
  balance: points,
  entries: z.array(entry).max(25),
  nextCursor: sequence.nullable(),
});
export type HistoryPage = z.infer<typeof historyPage>;
export function parseHistoryPage(
  value: unknown,
  profileId: string,
): HistoryPage {
  const page = historyPage.parse(value);
  if (
    page.profile.id !== profileId ||
    page.profile.balance !== page.balance ||
    page.entries.some((item) => item.profileId !== profileId) ||
    new Set(page.entries.map((item) => item.id)).size !== page.entries.length ||
    (page.nextCursor !== null &&
      page.nextCursor !== page.entries.at(-1)?.sequence)
  )
    throw new Error('Invalid History response.');
  return page;
}
