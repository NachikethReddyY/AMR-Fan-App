import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { useAccount, useSessionController } from '../account/provider';
import { useProfileContext } from '../account/useResource';
import { bindJourneySession, recorder } from './runtime';
import { journeyTask } from './location';

// Mounted above navigation: changing tabs must not stop an acknowledged capture.
export function JourneySession() {
  const session = useSessionController();
  useEffect(() => {
    const unbind = bindJourneySession(session.expire);
    let identity: string | null = null;
    const invalidate = session.subscribeIdentityInvalidation(() => {
      identity = null;
      void recorder.invalidate();
    });
    function syncIdentity() {
      const state = session.getState();
      if (state.kind !== 'signedIn') {
        identity = null;
        recorder.suspendNetwork();
        return;
      }
      const profile = state.account.profiles.find(
        (p) => p.kind === state.selected,
      );
      if (!profile) return;
      const next = `${state.token}:${profile.id}`;
      if (next === identity) return;
      identity = next;
      void recorder
        .restore({ token: state.token, profileId: profile.id })
        .then(() => recorder.retry());
    }
    const unsubscribe = session.subscribe(syncIdentity);
    syncIdentity();
    async function foreground() {
      const capture = recorder.getState().capture;
      if (!capture || capture.phase === 'finished') return;
      if (capture.phase === 'active') {
        await recorder.refreshStatus();
        const permission = await Location.getForegroundPermissionsAsync();
        const background = await Location.getBackgroundPermissionsAsync();
        if (!permission.granted || !background.granted) {
          await recorder.interrupt('permission_revoked');
        } else if (
          !(await Location.hasStartedLocationUpdatesAsync(journeyTask))
        ) {
          // OS termination is a gap. Only a user's explicit Resume restarts it.
          return;
        }
      }
      await recorder.retry();
    }
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void foreground();
    });
    const timer = setInterval(() => {
      if (
        AppState.currentState === 'active' &&
        !recorder.getState().busy &&
        recorder.getState().capture &&
        recorder.getState().capture?.phase !== 'finished'
      )
        void recorder.retry();
    }, 15000);
    return () => {
      unbind();
      invalidate();
      unsubscribe();
      app.remove();
      clearInterval(timer);
    };
  }, [session]);
  return null;
}
export function useJourneyRecorder() {
  const ctx = useProfileContext();
  const { state: account } = useAccount();
  const state = useSyncExternalStore(recorder.subscribe, recorder.getState);
  const owned =
    (ctx && state.capture?.journey.profileId === ctx.profileId) ||
    ((account.kind === 'loading' || account.kind === 'unavailable') &&
      state.capture !== null);
  return {
    recorder,
    ctx,
    state: owned
      ? state
      : { ...state, capture: null, award: null, collecting: false },
  };
}
