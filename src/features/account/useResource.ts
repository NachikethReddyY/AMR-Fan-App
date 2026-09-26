import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAccount } from './provider';
import { createResource, type Context, type Page } from './resource';
export function useProfileContext(): Context | null {
  const { state } = useAccount();
  const profile =
    state.kind === 'signedIn'
      ? state.account.profiles.find((p) => p.kind === state.selected)
      : null;
  return state.kind === 'signedIn' && profile
    ? { token: state.token, profileId: profile.id }
    : null;
}
export function useResource<T extends { id: string }>(
  read: (ctx: Context, cursor?: string) => Promise<Page<T>>,
) {
  const { controller: session } = useAccount();
  const ctx = useProfileContext();
  const [controller] = useState(() => createResource(read, session.expire));
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  useEffect(() => {
    void controller.setContext(ctx);
    return () => {
      void controller.setContext(null);
    };
  }, [controller, ctx?.token, ctx?.profileId]); // eslint-disable-line react-hooks/exhaustive-deps
  return { controller, state };
}
