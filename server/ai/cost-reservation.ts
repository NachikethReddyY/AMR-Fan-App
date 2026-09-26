import { z } from 'zod';

const model = z.enum(['openai/gpt-6-luna', 'typesafe/jev-1.13']);
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const rate = z.strictObject({
  model,
  inputNanoUsdPerToken: z.int().min(0).max(1_000_000_000),
  outputNanoUsdPerToken: z.int().min(0).max(1_000_000_000),
  fixedNanoUsd: z.int().min(0).max(10_000_000_000),
});
const rates = z
  .strictObject({
    revision: id,
    expiresAtMs: z.int().positive(),
    models: z.array(rate).min(1).max(2),
  })
  .refine(
    (value) =>
      new Set(value.models.map((item) => item.model)).size ===
      value.models.length,
  );
const call = z.strictObject({
  id,
  model,
  maxInputTokens: z.int().min(1).max(2_000_000),
  maxOutputTokens: z.int().min(1).max(128_000),
});
const planSchema = z
  .strictObject({
    operationId: id,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    calls: z.array(call).min(1).max(2),
  })
  .refine(
    (value) =>
      new Set(value.calls.map((item) => item.id)).size === value.calls.length,
  );
const capNanoUsd = 10_000_000_000;
export type ReservedAiCall = z.infer<typeof call> & {
  rate: z.infer<typeof rate>;
  reservedNanoUsd: number;
};
export type AiCostReservation = {
  scope: 'amr-tokenrouter-dev-and-demo';
  capNanoUsd: 10000000000;
  operationId: string;
  fingerprint: string;
  rateRevision: string;
  rateExpiresAtMs: number;
  reservedNanoUsd: number;
  calls: ReservedAiCall[];
};
export type AiUsageAccounting =
  | { kind: 'reported'; chargedNanoUsd: number }
  | {
      kind: 'held';
      heldNanoUsd: number;
      reason: 'usage-unknown' | 'bound-exceeded';
    };
type CallIdentity = Pick<
  AiCostReservation,
  'scope' | 'operationId' | 'fingerprint'
> & { callId: string };

/** DB-owner contract, not an in-memory budget implementation.
 * reserve: atomic global cap + operation fingerprint; never refresh a duplicate.
 * claimCall: atomic reserved->started exactly once; recheck expiry/cancellation.
 * reconcile: idempotent; never release unknown/in-flight spend. A bound violation
 * must block new admission until actual billing and provider bounds are resolved.
 */
export type AiCostStore = {
  reserve: (
    reservation: AiCostReservation,
  ) => Promise<'reserved' | 'duplicate' | 'exhausted'>;
  claimCall: (call: CallIdentity) => Promise<boolean>;
  reconcile: (
    call: CallIdentity & { accounting: AiUsageAccounting },
  ) => Promise<void>;
};
function amount(pricing: z.infer<typeof rate>, input: number, output: number) {
  return (
    BigInt(input) * BigInt(pricing.inputNanoUsdPerToken) +
    BigInt(output) * BigInt(pricing.outputNanoUsdPerToken) +
    BigInt(pricing.fixedNanoUsd)
  );
}

/** Validate persisted/caller-supplied quotes without trusting supplied amounts. */
export const aiCostReservationSchema = z
  .strictObject({
    scope: z.literal('amr-tokenrouter-dev-and-demo'),
    capNanoUsd: z.literal(10_000_000_000),
    operationId: id,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    rateRevision: id,
    rateExpiresAtMs: z.int().positive(),
    reservedNanoUsd: z.int().min(0).max(capNanoUsd),
    calls: z
      .array(
        call.extend({ rate, reservedNanoUsd: z.int().min(0).max(capNanoUsd) }),
      )
      .min(1)
      .max(2),
  })
  .refine((value) => {
    const total = value.calls.reduce(
      (sum, item) => sum + BigInt(item.reservedNanoUsd),
      0n,
    );
    return (
      total === BigInt(value.reservedNanoUsd) &&
      new Set(value.calls.map((item) => item.id)).size === value.calls.length &&
      value.calls.every(
        (item) =>
          item.model === item.rate.model &&
          amount(item.rate, item.maxInputTokens, item.maxOutputTokens) ===
            BigInt(item.reservedNanoUsd),
      )
    );
  });

/** Trusted, externally verified ceilings only. Parsing does not verify provider prices,
 * image tokenization, output enforcement, failover billing or remaining account funds.
 */
export function quoteAiCost(
  rateCard: unknown,
  plan: unknown,
  nowMs = Date.now(),
) {
  const parsedRates = rates.safeParse(rateCard);
  if (
    !parsedRates.success ||
    !Number.isSafeInteger(nowMs) ||
    parsedRates.data.expiresAtMs <= nowMs
  )
    return { kind: 'unavailable', reason: 'unverified-rates' } as const;
  const parsedPlan = planSchema.safeParse(plan);
  if (!parsedPlan.success)
    return { kind: 'unavailable', reason: 'invalid-plan' } as const;
  const calls: ReservedAiCall[] = [];
  let total = 0n;
  for (const item of parsedPlan.data.calls) {
    const pricing = parsedRates.data.models.find(
      (entry) => entry.model === item.model,
    );
    if (!pricing)
      return { kind: 'unavailable', reason: 'unverified-rates' } as const;
    const cost = amount(pricing, item.maxInputTokens, item.maxOutputTokens);
    total += cost;
    if (total > BigInt(capNanoUsd))
      return { kind: 'unavailable', reason: 'cap-exceeded' } as const;
    calls.push({ ...item, rate: pricing, reservedNanoUsd: Number(cost) });
  }
  const reservation: AiCostReservation = {
    scope: 'amr-tokenrouter-dev-and-demo',
    capNanoUsd,
    operationId: parsedPlan.data.operationId,
    fingerprint: parsedPlan.data.fingerprint,
    rateRevision: parsedRates.data.revision,
    rateExpiresAtMs: parsedRates.data.expiresAtMs,
    reservedNanoUsd: Number(total),
    calls,
  };
  return { kind: 'quoted', reservation } as const;
}

/** Admission only. Each provider dispatch still requires store.claimCall. */
export async function reserveAiCost({
  store,
  rateCard,
  plan,
  nowMs = Date.now(),
}: {
  store?: AiCostStore;
  rateCard: unknown;
  plan: unknown;
  nowMs?: number;
}) {
  const quote = quoteAiCost(rateCard, plan, nowMs);
  if (quote.kind === 'unavailable') return quote;
  if (!store)
    return { kind: 'unavailable', reason: 'budget-unavailable' } as const;
  try {
    const result = await store.reserve(quote.reservation);
    if (result === 'reserved')
      return { kind: 'reserved', reservation: quote.reservation } as const;
    if (result === 'duplicate' || result === 'exhausted')
      return { kind: 'unavailable', reason: result } as const;
  } catch {
    /* No DB details, secrets or raw provider errors cross this boundary. */
  }
  return { kind: 'unavailable', reason: 'budget-unavailable' } as const;
}

const usage = z.strictObject({
  inputTokens: z.int().nonnegative(),
  outputTokens: z.int().nonnegative(),
});
export function accountAiUsage(
  call: ReservedAiCall,
  raw: unknown,
): AiUsageAccounting {
  const parsed = usage.safeParse(raw);
  if (!parsed.success)
    return {
      kind: 'held',
      heldNanoUsd: call.reservedNanoUsd,
      reason: 'usage-unknown',
    };
  if (
    parsed.data.inputTokens > call.maxInputTokens ||
    parsed.data.outputTokens > call.maxOutputTokens
  )
    return {
      kind: 'held',
      heldNanoUsd: call.reservedNanoUsd,
      reason: 'bound-exceeded',
    };
  return {
    kind: 'reported',
    chargedNanoUsd: Number(
      amount(call.rate, parsed.data.inputTokens, parsed.data.outputTokens),
    ),
  };
}
