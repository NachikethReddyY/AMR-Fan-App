import { useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAccount } from '../account/provider';
import { api } from '../account/native-auth';
import { useProfileContext, useResource } from '../account/useResource';
import { createContributionApi } from './api';
import type { ContributionState } from './presentation';
const read = createContributionApi(api.request);
export function useContributions() {
  const resource = useResource(read);
  const ctx = useProfileContext();
  const { controller: session } = useAccount();
  const { controller } = resource;
  useEffect(
    () =>
      session.subscribeIdentityInvalidation(() => {
        void controller.setContext(null);
      }),
    [session, controller],
  );
  useFocusEffect(
    useCallback(() => {
      void controller.refresh();
    }, [controller]),
  );
  // Never render a previous profile while the shared resource's effect catches up.
  const state: ContributionState | null = !ctx
    ? null
    : resource.state.kind === 'ready' &&
        resource.state.items[0]?.id !== ctx.profileId
      ? { kind: 'loading' }
      : resource.state;
  return { ...resource, state };
}
