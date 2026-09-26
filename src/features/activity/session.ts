import type { SessionState } from '../account/session';

export type PhotoOwner = { accountId: string; profileId: string };
export function photoOwner(state: SessionState): PhotoOwner | null {
  if (state.kind !== 'signedIn' || state.selected !== 'real') return null;
  const profile = state.account.profiles.find((item) => item.kind === 'real');
  return profile
    ? { accountId: state.account.id, profileId: profile.id }
    : null;
}
export function photoAccess(
  owner: PhotoOwner,
  state: SessionState,
): 'refreshing' | 'authorized' | 'revoked' {
  if (state.kind === 'loading') return 'refreshing';
  const current = photoOwner(state);
  return current?.accountId === owner.accountId &&
    current.profileId === owner.profileId
    ? 'authorized'
    : 'revoked';
}
