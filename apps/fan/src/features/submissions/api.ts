import { z } from 'zod';
import type { Request } from '../account/api.ts';
import type { Context } from '../account/resource.ts';
import {
  ownedSubmission,
  submissionSchema,
  type SubmissionInput,
} from './contracts.ts';
export function createSubmissionsApi(request: Request) {
  const path = (ctx: Context) =>
    `/v1/profiles/${encodeURIComponent(ctx.profileId)}/submissions`;
  return {
    list: async (ctx: Context, before?: string) => {
      const q = new URLSearchParams({ limit: '25' });
      if (before) q.set('before', before);
      const p = z
        .object({
          submissions: z.array(submissionSchema).max(25),
          nextCursor: z
            .string()
            .regex(/^[1-9]\d{0,18}$/)
            .nullable(),
        })
        .parse(await request(`${path(ctx)}?${q}`, ctx.token));
      return {
        items: p.submissions.map((s) => ownedSubmission(s, ctx.profileId)),
        nextCursor: p.nextCursor,
      };
    },
    submit: async (ctx: Context, input: SubmissionInput) => {
      const raw = z
        .object({ outcome: z.unknown() })
        .parse(await request(path(ctx), ctx.token, 'POST', input));
      return ownedSubmission(raw.outcome, ctx.profileId);
    },
  };
}
