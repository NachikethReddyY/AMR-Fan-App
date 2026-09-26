import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AccountError } from '../account/api';
import type { createSessionController } from '../account/session';
import { createActivityApi } from './api';
import { discardCameraCache } from './native-camera';
import { photoOwner, type PhotoOwner } from './session';

const checkAvailability = createActivityApi(
  process.env.EXPO_PUBLIC_API_URL ?? '',
  __DEV__,
);

export function usePhotoActivity(
  session: ReturnType<typeof createSessionController>,
) {
  const state = useSyncExternalStore(session.subscribe, session.getState);
  const [owner, setOwner] = useState<PhotoOwner | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const close = useCallback(() => setOwner(null), []);
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
          setCleanupError(
            'Could not clear the previous camera photo. Reopen the app to retry.',
          );
      });
    return () => {
      mounted = false;
    };
  }, []);
  const availableOwner = photoOwner(state);
  return {
    owner,
    close,
    cleanupError,
    canOpen: !!availableOwner && !cleanupError,
    open: () => {
      if (availableOwner && !cleanupError) setOwner(availableOwner);
    },
    check: async (token: string, profileId: string, signal: AbortSignal) => {
      try {
        return await checkAvailability(token, profileId, signal);
      } catch (error) {
        if (error instanceof AccountError && error.status === 401)
          await session.expire(token);
        throw error;
      }
    },
  };
}
