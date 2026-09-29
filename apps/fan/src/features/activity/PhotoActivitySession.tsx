import { useEffect, useSyncExternalStore } from 'react';
import type { SessionState } from '../account/session';
import { PhotoActivity } from './PhotoActivity';
import { photoAccess, type PhotoOwner } from './session';
import type { ActivityResult } from './lifecycle';

type SessionSource = {
  getState: () => SessionState;
  subscribe: (listener: () => void) => () => void;
};

/** Owner is captured on the explicit Photo activity action, never replaced by refresh. */
export function PhotoActivitySession({
  owner,
  session,
  check,
  onClose,
}: {
  owner: PhotoOwner;
  session: SessionSource;
  check: (
    token: string,
    profileId: string,
    signal: AbortSignal,
  ) => Promise<ActivityResult>;
  onClose: () => void;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getState);
  const access = photoAccess(owner, state);
  useEffect(
    () =>
      session.subscribe(() => {
        if (photoAccess(owner, session.getState()) === 'revoked') onClose();
      }),
    [owner, session, onClose],
  );
  if (access === 'revoked') return null;
  async function authorizedCheck(signal: AbortSignal) {
    const current = session.getState();
    if (
      current.kind !== 'signedIn' ||
      photoAccess(owner, current) !== 'authorized'
    )
      throw new Error('Sign in again.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const unsubscribe = session.subscribe(() => {
      const next = session.getState();
      if (
        next.kind !== 'signedIn' ||
        next.token !== current.token ||
        photoAccess(owner, next) !== 'authorized'
      )
        abort();
    });
    try {
      if (signal.aborted) abort();
      const result = await check(
        current.token,
        owner.profileId,
        controller.signal,
      );
      if (controller.signal.aborted) throw new Error('Session changed.');
      return result;
    } finally {
      unsubscribe();
      signal.removeEventListener('abort', abort);
    }
  }
  return (
    <PhotoActivity
      onClose={onClose}
      check={authorizedCheck}
      canCheck={access === 'authorized'}
    />
  );
}
