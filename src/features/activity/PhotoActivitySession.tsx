import { useEffect, useSyncExternalStore } from 'react';
import type { SessionState } from '../account/session';
import { PhotoActivity } from './PhotoActivity';
import { photoAccess, type PhotoOwner } from './session';
import type {
  ActivityCapability,
  ActivityAssessmentResult,
  ActivitySubmissionInput,
} from './api';
import type { ActivityResult } from './lifecycle';
type SessionSource = {
  getState: () => SessionState;
  subscribe: (listener: () => void) => () => void;
};
type Call<T> = (
  token: string,
  profileId: string,
  signal: AbortSignal,
) => Promise<T>;
type Props = {
  owner: PhotoOwner;
  session: SessionSource;
  check?: Call<ActivityResult | ActivityCapability>;
  capability?: Call<ActivityCapability>;
  submit?: (
    token: string,
    profileId: string,
    input: ActivitySubmissionInput,
    signal: AbortSignal,
  ) => Promise<ActivityAssessmentResult>;
  recover?: (
    token: string,
    profileId: string,
    requestId: string,
    signal: AbortSignal,
  ) => Promise<import('./api').ActivityRecovery>;
  onSettled?: () => void;
  missionId?: string | null;
  onClose: () => void;
};
export function PhotoActivitySession({
  owner,
  session,
  check,
  capability,
  submit,
  recover,
  onSettled,
  missionId,
  onClose,
}: Props) {
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
  async function authorized<T>(call: Call<T>, signal: AbortSignal) {
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
      const result = await call(
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
  const authorizedCapability = capability
    ? (signal: AbortSignal) => authorized(capability, signal)
    : check
      ? (signal: AbortSignal) => authorized(check, signal)
      : undefined;
  const authorizedSubmit = submit
    ? (input: ActivitySubmissionInput, signal: AbortSignal) =>
        authorized(
          (token, profileId, current) =>
            submit(token, profileId, input, current),
          signal,
        )
    : undefined;
  const authorizedRecover = recover
    ? (requestId: string, signal: AbortSignal) =>
        authorized(
          (token, profileId, current) =>
            recover(token, profileId, requestId, current),
          signal,
        )
    : undefined;
  return (
    <PhotoActivity
      onClose={onClose}
      check={authorizedCapability}
      submit={authorizedSubmit}
      recover={authorizedRecover}
      onSettled={onSettled}
      missionId={missionId}
      canCheck={access === 'authorized'}
    />
  );
}
