import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { useAccount, useSessionController } from '../account/provider';
import { api } from '../account/native-auth';
import { createHistoryController, type HistoryState } from './history';
import { PointsTextProvider } from './controls';

const Context = createContext<ReturnType<
  typeof createHistoryController
> | null>(null);
export function PointsProvider({ children }: { children: React.ReactNode }) {
  const session = useSessionController();
  const [controller] = useState(() =>
    createHistoryController(api.history, session.expire),
  );
  useEffect(() => {
    function sync() {
      const state = session.getState();
      const profile =
        state.kind === 'signedIn'
          ? state.account.profiles.find((p) => p.kind === state.selected)
          : undefined;
      void controller.setContext(
        state.kind === 'signedIn' && profile
          ? { token: state.token, profileId: profile.id }
          : null,
      );
    }
    const unsubscribe = session.subscribe(sync);
    sync();
    return () => {
      unsubscribe();
      void controller.setContext(null);
    };
  }, [session, controller]);
  return (
    <Context.Provider value={controller}>
      <PointsTextProvider>{children}</PointsTextProvider>
    </Context.Provider>
  );
}
export function useHistory() {
  const controller = useContext(Context);
  if (!controller) throw new Error('PointsProvider is required.');
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
  );
  const { state: account } = useAccount();
  const profile =
    account.kind === 'signedIn'
      ? account.account.profiles.find((p) => p.kind === account.selected)
      : undefined;
  // Hide a previous profile even before React flushes provider effects.
  const state: HistoryState =
    profile && snapshot.kind !== 'idle' && snapshot.profileId === profile.id
      ? snapshot
      : { kind: 'idle' };
  return { controller, state, account, profile };
}
