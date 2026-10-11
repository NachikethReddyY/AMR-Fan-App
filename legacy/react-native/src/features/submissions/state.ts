import { createIntent, type IntentStorage } from '../account/resource.ts';
import { submissionInput } from './contracts.ts';
import type { createSubmissionsApi } from './api.ts';
export function createSubmissionController(
  api: ReturnType<typeof createSubmissionsApi>,
  storage: IntentStorage,
  expired: (token: string) => void | Promise<void>,
) {
  return createIntent({
    name: 'submission-v1',
    storage,
    parse: (v) => submissionInput.parse(v),
    execute: api.submit,
    expired,
  });
}
