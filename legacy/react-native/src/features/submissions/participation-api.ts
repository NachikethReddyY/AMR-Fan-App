import { z } from 'zod';
import type { Request } from '../account/api.ts';
import type { Context } from '../account/resource.ts';
import {
  contributionIntent,
  contributionReceipt,
  participationHistoryPage,
  rankingPage,
  type ContributionIntent,
} from './participation-contracts.ts';

export function createParticipationApi(request: Request) {
  return {
    ranking: async (ctx: Context, after?: string) => {
      const query = new URLSearchParams({ limit: '25' });
      if (after) query.set('after', after);
      return rankingPage.parse(
        await request(`/v1/submissions/ranking?${query}`, ctx.token),
      );
    },
    history: async (ctx: Context, before?: string) => {
      const query = new URLSearchParams({ limit: '25' });
      if (before) query.set('before', before);
      const page = participationHistoryPage.parse(
        await request(
          `/v1/profiles/${encodeURIComponent(ctx.profileId)}/submission-participation?${query}`,
          ctx.token,
        ),
      );
      return {
        ...page,
        items: page.items.map((row) => ({ ...row, id: row.pointsOperationId })),
      };
    },
    contribute: async (ctx: Context, intent: ContributionIntent) => {
      const { submissionId, requestId, points } =
        contributionIntent.parse(intent);
      const receipt = z
        .object({ outcome: contributionReceipt })
        .parse(
          await request(
            `/v1/profiles/${encodeURIComponent(ctx.profileId)}/submissions/${encodeURIComponent(submissionId)}/contributions`,
            ctx.token,
            'POST',
            { requestId, points },
          ),
        ).outcome;
      if (receipt.submissionId !== submissionId || receipt.points !== points)
        throw new Error('Contribution receipt does not match confirmation.');
      return receipt;
    },
  };
}
