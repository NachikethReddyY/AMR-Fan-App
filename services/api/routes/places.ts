import { z } from 'zod';
import { routeConfig } from './config.ts';
import { createOneMapProvider } from './onemap.ts';

const input = z.strictObject({
  query: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
});

export type PlaceSearchResult = Awaited<
  ReturnType<ReturnType<typeof createPlaceSearch>>
>;

/** One bounded place-search seam shared by both native clients. */
export function createPlaceSearch(
  env: Record<string, string | undefined> = process.env,
) {
  const selected = routeConfig(env);
  const provider =
    selected.kind === 'onemap' ? createOneMapProvider(selected) : null;
  return async (raw: unknown) => {
    const parsed = input.safeParse(raw);
    if (!parsed.success)
      return { kind: 'unavailable' as const, reason: 'invalid_input' as const };
    if (!provider)
      return {
        kind: 'unavailable' as const,
        reason: 'live_not_configured' as const,
      };
    return provider.searchPlaces(parsed.data.query);
  };
}
