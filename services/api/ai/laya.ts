import { z } from 'zod';
import {
  categories,
  moderationFlags,
  questions,
  submission,
  tags,
  unavailable,
  unclassifiedReport,
} from './contracts.ts';
import { boundedTransport } from './transport.ts';
import type { Config } from './transport.ts';

const answer = <T extends readonly [string, ...string[]]>(values: T) =>
  z.object({
    choice: z.enum(values),
    confidence: z.number().finite().min(0).max(1).optional(),
  });

export function createLaya(config: Config) {
  const post = boundedTransport(
    `${config.LAYA_BASE_URL.replace(/\/$/, '')}/v1/systemone`,
    config.layaTimeoutMs,
  );
  return {
    async adviseSubmission(input: unknown) {
      const parsed = submission.safeParse(input);
      if (!parsed.success) return unavailable('invalid-input');
      const { text, tag, moderation } = parsed.data;
      if (tag !== null && moderation !== null)
        return { kind: 'skipped' as const, reviewRequired: true as const };
      if (!config.LAYA_ADVISORY_ENABLED) return unavailable('disabled');
      const requested = {
        ...(tag === null ? { tag: questions.tag } : {}),
        ...(moderation === null ? { moderation: questions.moderation } : {}),
      };
      const result = await post({ state: text, questions: requested });
      if (!result.ok) return unavailable(result.reason);
      const schema = z.object({
        answers: z.strictObject({
          ...(tag === null ? { tag: answer(tags) } : {}),
          ...(moderation === null
            ? { moderation: answer(moderationFlags) }
            : {}),
        }),
      });
      const response = schema.safeParse(result.value);
      if (!response.success) return unavailable('invalid-output');
      return {
        kind: 'advisory' as const,
        reviewRequired: true as const,
        suggestions: response.data.answers,
      };
    },
    async classifyReport(input: unknown) {
      const parsed = unclassifiedReport.safeParse(input);
      if (!parsed.success) return unavailable('invalid-input');
      if (parsed.data.category !== null)
        return { kind: 'skipped' as const, reviewRequired: true as const };
      if (!config.LAYA_ADVISORY_ENABLED) return unavailable('disabled');
      const result = await post({
        state: parsed.data.text,
        questions: { category: questions.category },
      });
      if (!result.ok) return unavailable(result.reason);
      const parsedResult = z
        .object({ answers: z.strictObject({ category: answer(categories) }) })
        .safeParse(result.value);
      if (!parsedResult.success) return unavailable('invalid-output');
      return {
        kind: 'advisory' as const,
        reviewRequired: true as const,
        category: parsedResult.data.answers.category.choice,
      };
    },
  };
}
