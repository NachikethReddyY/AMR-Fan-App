import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AccountError } from '../account/api';
import type { createSessionController } from '../account/session';
import { createActivityApi, type ActivitySubmissionInput } from './api';
import { discardCameraCache } from './native-camera';
import { photoOwner, type PhotoOwner } from './session';
const activityApi = createActivityApi(
  process.env.EXPO_PUBLIC_API_URL ?? '',
  __DEV__,
);
export function usePhotoActivity(
  session: ReturnType<typeof createSessionController>,
) {
  const state = useSyncExternalStore(session.subscribe, session.getState);
  const [owner, setOwner] = useState<PhotoOwner | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [cleanupAttempt, setCleanupAttempt] = useState(0);
  const close = useCallback(() => setOwner(null), []);
  const retryCleanup = useCallback(() => {
    setCleanupError(null);
    setCleanupAttempt((current) => current + 1);
  }, []);
  useEffect(
    () => session.subscribeIdentityInvalidation(close),
    [session, close],
  );
  useFocusEffect(useCallback(() => close, [close]));
  useEffect(() => {
    let mounted = true;
    void Promise.resolve()
      .then(discardCameraCache)
      .catch(() => {
        if (mounted)
          setCleanupError('Could not clear the previous camera photo. Retry.');
      });
    return () => {
      mounted = false;
    };
  }, [cleanupAttempt]);
  const availableOwner = photoOwner(state);
  async function guarded<T>(token: string, call: () => Promise<T>) {
    try {
      return await call();
    } catch (error) {
      if (error instanceof AccountError && error.status === 401)
        await session.expire(token);
      throw error;
    }
  }
  return {
    owner,
    close,
    cleanupError,
    retryCleanup,
    canOpen: !!availableOwner && !cleanupError,
    open: () => {
      if (availableOwner && !cleanupError) setOwner(availableOwner);
    },
    capability: (token: string, profileId: string, signal: AbortSignal) =>
      guarded(token, () => activityApi.capability(token, profileId, signal)),
    check: (token: string, profileId: string, signal: AbortSignal) =>
      guarded(token, () => activityApi.capability(token, profileId, signal)),
    submit: (
      token: string,
      profileId: string,
      input: ActivitySubmissionInput,
      signal: AbortSignal,
    ) =>
      guarded(token, () => activityApi.submit(token, profileId, input, signal)),
    recover: (
      token: string,
      profileId: string,
      requestId: string,
      signal: AbortSignal,
    ) =>
      guarded(token, () =>
        activityApi.recover(token, profileId, requestId, signal),
      ),
  };
}
