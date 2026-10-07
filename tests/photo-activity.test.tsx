import React, { act, useEffect as mockUseEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { usePhotoActivity } from '../src/features/activity/usePhotoActivity';
import {
  createSessionController,
  type SessionState,
  type StoredSession,
} from '../src/features/account/session';
import type { AccountApi } from '../src/features/account/api';
import { PhotoActivity } from '../src/features/activity/PhotoActivity';
import { PhotoActivitySession } from '../src/features/activity/PhotoActivitySession';
import type { capturePhoto } from '../src/features/activity/native-camera';
import type {
  ActivityAssessmentResult,
  ActivityCapability,
  ActivitySubmissionInput,
} from '../src/features/activity/api';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});

jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000001',
}));
jest.mock('expo/virtual/env', () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: true,
    configurable: true,
  });
  return { env: { EXPO_PUBLIC_API_URL: '' } };
});

let mockBlur: (() => void) | undefined;
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => () => void) => {
    mockUseEffect(() => {
      mockBlur = effect();
      return mockBlur;
    }, [effect]);
  },
}));

const mockCapture = jest.fn<typeof capturePhoto>();
jest.mock('../src/features/activity/native-camera', () => ({
  capturePhoto: () => mockCapture(),
  discardCameraCache: () => {},
}));
jest.mock('../src/features/points/controls', () => ({
  Text: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  Action: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onPress} disabled={disabled}>
      {label}
    </button>
  ),
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Image: ({ accessibilityLabel }: { accessibilityLabel: string }) => (
    <span>{accessibilityLabel}</span>
  ),
  Linking: { openSettings: async () => {} },
  TextInput: ({
    value,
    onChangeText,
    accessibilityLabel,
  }: {
    value: string;
    onChangeText: (text: string) => void;
    accessibilityLabel: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      value={value}
      onChange={(event) => onChangeText(event.target.value)}
    />
  ),
}));

const capability: ActivityCapability = {
  kind: 'available',
  mode: 'synthetic_test',
  limits: { photos: 5, description: 1600 },
};
const accepted: ActivityAssessmentResult = {
  kind: 'accepted',
  assessmentId: '00000000-0000-4000-8000-000000000002',
  category: 'active_transport',
  evidenceScore: 82,
  confidence: 0.9,
  rationale: 'The photo and description show a supported activity.',
  evidenceItems: ['Public transport is visible.'],
  modelVersion: 'synthetic-v1',
  policyVersion: 'activity-evidence-v1',
};
const unavailable: ActivityAssessmentResult = {
  kind: 'unavailable',
  reason: 'disabled',
};

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  jest.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  mockBlur = undefined;
  mockCapture.mockReset();
  mockCapture.mockResolvedValue({
    kind: 'photo',
    base64: 'YWJj',
    mime: 'image/jpeg',
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  jest.useRealTimers();
});

function button(label: string) {
  const result = [...host.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  expect(result).toBeDefined();
  return result!;
}
function descriptionInput() {
  const input = host.querySelector('input[aria-label="Activity description"]');
  expect(input).toBeInstanceOf(HTMLInputElement);
  return input as HTMLInputElement;
}
async function describe(value = 'Took the bus') {
  const input = descriptionInput();
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function mountActivity({
  check = jest.fn(async () => capability),
  submit = jest.fn(async (_input: ActivitySubmissionInput) => accepted),
  recover,
}: {
  check?: (signal: AbortSignal) => Promise<ActivityCapability>;
  submit?: (
    input: ActivitySubmissionInput,
    signal: AbortSignal,
  ) => Promise<ActivityAssessmentResult>;
  recover?: (
    requestId: string,
    signal: AbortSignal,
  ) => Promise<import('../src/features/activity/api').ActivityRecovery>;
} = {}) {
  const close = jest.fn();
  await act(async () =>
    root.render(
      <PhotoActivity
        onClose={close}
        check={check}
        submit={submit}
        recover={recover}
      />,
    ),
  );
  await act(async () => jest.runOnlyPendingTimers());
  return { close, check, submit, recover };
}

test('capability is checked before the first camera capture and submit sends ordered photos', async () => {
  const calls: string[] = [];
  const check = jest.fn(async () => {
    calls.push('capability');
    return capability;
  });
  const submit = jest.fn(async (input: ActivitySubmissionInput) => {
    calls.push('submit');
    return accepted;
  });
  await mountActivity({ check, submit });
  expect(check).toHaveBeenCalledTimes(1);
  expect(mockCapture).toHaveBeenCalledTimes(1);
  expect(calls).toEqual(['capability']);
  await describe();
  await act(async () => button('Submit activity').click());
  expect(calls).toEqual(['capability', 'submit']);
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({
      requestId: '00000000-0000-4000-8000-000000000001',
      description: 'Took the bus',
      missionId: null,
      photos: [{ mime: 'image/jpeg', base64: 'YWJj' }],
    }),
    expect.any(AbortSignal),
  );
  expect(host.textContent).toContain('Evidence score 82 / 100');
});

test('blank draft keeps submit disabled and duplicate photos are rejected', async () => {
  await mountActivity();
  expect(button('Submit activity').disabled).toBe(true);
  mockCapture.mockResolvedValueOnce({
    kind: 'photo',
    base64: 'YWJj',
    mime: 'image/jpeg',
  });
  await act(async () => button('Add photo').click());
  expect(host.textContent).toContain('That photo is already selected');
  expect(host.textContent).not.toContain('Activity photo 2 of 2');
});

test('multi-photo drafts stop at five and expose a clear maximum', async () => {
  const photos = ['YWJj', 'ZGVm', 'Z2hp', 'amts', 'bW5v'];
  mockCapture.mockReset();
  mockCapture.mockResolvedValueOnce({
    kind: 'photo',
    base64: photos[0],
    mime: 'image/jpeg',
  });
  for (const base64 of photos.slice(1))
    mockCapture.mockResolvedValueOnce({
      kind: 'photo',
      base64,
      mime: 'image/jpeg',
    });
  await mountActivity();
  for (let index = 1; index < photos.length; index++)
    await act(async () => button('Add photo').click());
  expect(host.textContent).toContain('Activity photo 5 of 5');
  expect(host.textContent).toContain('Maximum 5 photos selected.');
  expect(host.querySelectorAll('button').length).toBeGreaterThan(0);
  expect(() => button('Add photo')).toThrow();
  expect(mockCapture).toHaveBeenCalledTimes(5);
});

test('pending submit disables the draft and keeps the request payload stable', async () => {
  let resolve: ((result: ActivityAssessmentResult) => void) | undefined;
  const submit = jest.fn(
    (_input: ActivitySubmissionInput) =>
      new Promise<ActivityAssessmentResult>((done) => {
        resolve = done;
      }),
  );
  await mountActivity({ submit });
  await describe();
  await act(async () => button('Submit activity').click());
  expect(button('Submitting activity…').disabled).toBe(true);
  expect(button('Add photo').disabled).toBe(true);
  expect(submit.mock.calls[0]?.[0]).toMatchObject({
    requestId: '00000000-0000-4000-8000-000000000001',
    description: 'Took the bus',
  });
  await act(async () => resolve?.(accepted));
  expect(host.textContent).toContain('Evidence score 82 / 100');
});

test('transport failure exposes recovery and uses the same request ID', async () => {
  const submit = jest.fn(async () => {
    throw new Error('network dropped');
  });
  const recover = jest.fn(async (requestId: string) => {
    expect(requestId).toBe('00000000-0000-4000-8000-000000000001');
    return { kind: 'replay' as const, result: accepted };
  });
  await mountActivity({ submit, recover });
  await describe();
  await act(async () => button('Submit activity').click());
  expect(host.textContent).toContain('Submission outcome is unconfirmed');
  await act(async () => button('Check saved result').click());
  expect(recover).toHaveBeenCalledWith(
    '00000000-0000-4000-8000-000000000001',
    expect.any(AbortSignal),
  );
  expect(host.textContent).toContain('Evidence score 82 / 100');
});

test('closing clears selected bytes and cancels a pending submission', async () => {
  let resolve: ((result: ActivityAssessmentResult) => void) | undefined;
  let signal: AbortSignal | undefined;
  const photo = {
    kind: 'photo' as const,
    base64: 'YWJj',
    mime: 'image/jpeg' as const,
  };
  mockCapture.mockResolvedValue(photo);
  const submit = jest.fn(
    (_input: ActivitySubmissionInput, currentSignal: AbortSignal) => {
      signal = currentSignal;
      return new Promise<ActivityAssessmentResult>((done) => {
        currentSignal.addEventListener('abort', () => done(unavailable), {
          once: true,
        });
        resolve = done;
      });
    },
  );
  const { close } = await mountActivity({ submit });
  await describe();
  await act(async () => button('Submit activity').click());
  await act(async () => button('Close').click());
  expect(close).toHaveBeenCalledTimes(1);
  expect(signal?.aborted).toBe(true);
  expect(photo.base64).toBe('');
  expect(resolve).toBeDefined();
  expect(host.textContent).not.toContain('Activity photo 1 of 1');
});

function signedIn(
  id = 'A',
  token = 'old',
): Extract<SessionState, { kind: 'signedIn' }> {
  return {
    kind: 'signedIn',
    token,
    selected: 'real',
    account: {
      id,
      role: 'fan',
      profiles: [
        { id: `${id}-profile`, kind: 'real', displayName: id, balance: 0 },
      ],
    },
  };
}
function sessionSource() {
  let state: SessionState = signedIn();
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next: SessionState) {
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
}
async function mountSession(props: {
  session: ReturnType<typeof sessionSource>;
  close?: () => void;
  capability?: (
    token: string,
    profileId: string,
    signal: AbortSignal,
  ) => Promise<ActivityCapability>;
  submit?: (
    token: string,
    profileId: string,
    input: ActivitySubmissionInput,
    signal: AbortSignal,
  ) => Promise<ActivityAssessmentResult>;
}) {
  const close = props.close ?? jest.fn();
  await act(async () =>
    root.render(
      <PhotoActivitySession
        owner={{ accountId: 'A', profileId: 'A-profile' }}
        session={props.session}
        capability={props.capability ?? (async () => capability)}
        submit={props.submit}
        onClose={close}
      />,
    ),
  );
  await act(async () => jest.runOnlyPendingTimers());
  return close;
}

test('same-account loading preserves the draft and submits through the refreshed session callback', async () => {
  const session = sessionSource();
  const photo = {
    kind: 'photo' as const,
    base64: 'YWJj',
    mime: 'image/jpeg' as const,
  };
  mockCapture.mockResolvedValue(photo);
  const oldCapability = jest.fn(async () => capability);
  const oldSubmit = jest.fn(async () => accepted);
  const newSubmit = jest.fn(async () => accepted);
  const close = jest.fn();
  const render = (token: 'old' | 'new') => (
    <PhotoActivitySession
      owner={{ accountId: 'A', profileId: 'A-profile' }}
      session={session}
      capability={oldCapability}
      submit={async (currentToken, profileId, input, signal) => {
        expect(currentToken).toBe(token);
        expect(profileId).toBe('A-profile');
        expect(input.description).toBe('Took the bus');
        return token === 'old' ? oldSubmit() : newSubmit();
      }}
      onClose={close}
    />
  );
  await act(async () => root.render(render('old')));
  await act(async () => jest.runOnlyPendingTimers());
  await describe();
  await act(async () => session.set({ kind: 'loading' }));
  expect(host.textContent).toContain('Activity photo 1 of 1');
  expect(descriptionInput().value).toBe('Took the bus');
  await act(async () => {
    session.set(signedIn('A', 'new'));
    root.render(render('new'));
  });
  await act(async () => button('Submit activity').click());
  expect(oldCapability).toHaveBeenCalledTimes(1);
  expect(oldSubmit).not.toHaveBeenCalled();
  expect(newSubmit).toHaveBeenCalledTimes(1);
  expect(photo.base64).toBe('');
  expect(close).not.toHaveBeenCalled();
});

test('permission denial shows settings after capability succeeds and never submits', async () => {
  mockCapture.mockResolvedValue({ kind: 'denied', canAskAgain: false });
  const submit = jest.fn(async () => accepted);
  const { check } = await mountActivity({ submit });
  expect(host.textContent).toContain('Allow camera access');
  expect(button('Open Settings').disabled).toBe(false);
  expect(check).toHaveBeenCalledTimes(1);
  expect(submit).not.toHaveBeenCalled();
});

test('account switch aborts an in-flight submit and ignores its late result', async () => {
  const session = sessionSource();
  const photo = {
    kind: 'photo' as const,
    base64: 'YWJj',
    mime: 'image/jpeg' as const,
  };
  mockCapture.mockResolvedValue(photo);
  let finish: ((result: ActivityAssessmentResult) => void) | undefined;
  let signal: AbortSignal | undefined;
  const submit = jest.fn(
    async (
      _token: string,
      _profile: string,
      _input: ActivitySubmissionInput,
      current: AbortSignal,
    ) => {
      signal = current;
      return new Promise<ActivityAssessmentResult>((resolve) => {
        finish = resolve;
      });
    },
  );
  const close = await mountSession({ session, submit });
  await describe();
  await act(async () => button('Submit activity').click());
  await act(async () => session.set(signedIn('B')));
  expect(signal?.aborted).toBe(true);
  expect(photo.base64).toBe('');
  await act(async () => finish?.(accepted));
  expect(close).toHaveBeenCalled();
  expect(host.textContent).toBe('');
});

test('logout while the camera is open discards a late capture', async () => {
  let resolve:
    ((photo: Awaited<ReturnType<typeof capturePhoto>>) => void) | undefined;
  mockCapture.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const session = sessionSource();
  const close = await mountSession({ session });
  await act(async () => session.set({ kind: 'signedOut', error: null }));
  const photo = {
    kind: 'photo' as const,
    base64: 'YWJj',
    mime: 'image/jpeg' as const,
  };
  await act(async () => resolve?.(photo));
  expect(photo.base64).toBe('');
  expect(close).toHaveBeenCalled();
  expect(host.textContent).toBe('');
});

async function mountHomeOwner() {
  const initial = signedIn();
  let stored: StoredSession | null = null;
  const api: AccountApi = {
    signIn: async () => {
      throw new Error('Unused');
    },
    syntheticSignIn: async () => {
      throw new Error('Unused');
    },
    resume: async () => initial.account,
    logout: async () => {},
    rename: async () => initial.account.profiles[0],
    history: async () => {
      throw new Error('Unused');
    },
  };
  const session = createSessionController(api, {
    read: async () => stored,
    write: async (next) => {
      stored = next;
    },
    clear: async () => {
      stored = null;
    },
  });
  await session.signIn(async () => ({
    token: 'old',
    account: initial.account,
    expiresAt: '2030-01-01',
  }));
  function HomeOwner() {
    const photo = usePhotoActivity(session);
    return photo.owner ? (
      <PhotoActivitySession
        owner={photo.owner}
        session={session}
        capability={async () => capability}
        submit={async () => accepted}
        onClose={photo.close}
      />
    ) : (
      <button disabled={!photo.canOpen} onClick={photo.open}>
        Photo activity
      </button>
    );
  }
  await act(async () => root.render(<HomeOwner />));
  await act(async () => button('Photo activity').click());
  await act(async () => jest.runOnlyPendingTimers());
  return { session };
}

test.each(['logout', 'switch', 'expire'] as const)(
  'Home closes and releases the draft at explicit %s intent',
  async (operation) => {
    const photo = {
      kind: 'photo' as const,
      base64: 'YWJj',
      mime: 'image/jpeg' as const,
    };
    mockCapture.mockResolvedValue(photo);
    const { session } = await mountHomeOwner();
    await describe();
    await act(async () => {
      if (operation === 'logout') await session.logout();
      else if (operation === 'switch') await session.select('demo');
      else await session.expire('old');
    });
    expect(photo.base64).toBe('');
    expect(host.querySelector('input')).toBeNull();
    expect(button('Photo activity').disabled).toBe(true);
  },
);

test('Home retains draft through foreground refresh and clears it on navigation blur', async () => {
  const photo = {
    kind: 'photo' as const,
    base64: 'YWJj',
    mime: 'image/jpeg' as const,
  };
  mockCapture.mockResolvedValue(photo);
  const { session } = await mountHomeOwner();
  await describe();
  const pending = act(async () => session.resume());
  expect(host.querySelector('input')?.value).toBe('Took the bus');
  await pending;
  expect(host.querySelector('input')?.value).toBe('Took the bus');
  await act(async () => mockBlur?.());
  expect(host.textContent).not.toContain('Activity photo 1 of 1');
  expect(button('Photo activity').disabled).toBe(false);
});
