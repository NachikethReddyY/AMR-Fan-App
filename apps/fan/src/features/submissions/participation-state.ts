import { createIntent, type IntentStorage } from '../account/resource.ts';
import type { createParticipationApi } from './participation-api.ts';
import {
  contributionIntent,
  type SharedSubmission,
} from './participation-contracts.ts';

export function reviewContribution(
  item: SharedSubmission,
  amount: string,
  requestId: string,
) {
  if (item.status !== 'backlog')
    throw new Error('Contributions are closed for this submission.');
  if (!/^[1-9]\d*$/.test(amount))
    throw new Error('Enter a whole number of points, at least 10.');
  return contributionIntent.parse({
    submissionId: item.id,
    requestId,
    points: Number(amount),
  });
}
export function createContributionController(
  api: Pick<ReturnType<typeof createParticipationApi>, 'contribute'>,
  storage: IntentStorage,
  expired: (token: string) => void | Promise<void>,
) {
  return createIntent({
    name: 'contribution-v1',
    storage,
    parse: (value) => contributionIntent.parse(value),
    execute: api.contribute,
    expired,
  });
}
