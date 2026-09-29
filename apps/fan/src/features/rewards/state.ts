import { createIntent, type IntentStorage } from '../account/resource.ts';
import { purchaseSchema } from './contracts.ts';
import type { createRewardsApi } from './api.ts';
export function createPurchaseController(
  api: ReturnType<typeof createRewardsApi>,
  storage: IntentStorage,
  expired: (token: string) => void | Promise<void>,
) {
  return createIntent({
    name: 'reward-v1',
    storage,
    parse: (v) => purchaseSchema.parse(v),
    execute: api.purchase,
    expired,
  });
}
