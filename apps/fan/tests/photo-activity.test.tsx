import React, { act, useEffect as mockUseEffect } from 'react';
import { usePhotoActivity } from '../src/features/activity/usePhotoActivity';
import {
  createSessionController,
  type StoredSession,
  type SessionState,
} from '../src/features/account/session';
import type { AccountApi } from '../src/features/account/api';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { PhotoActivity } from '../src/features/activity/PhotoActivity';
import type { capturePhoto } from '../src/features/activity/native-camera';
import { PhotoActivitySession } from '../src/features/activity/PhotoActivitySession';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});

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
      onChange={(e) => onChangeText(e.target.value)}
    />
  ),
}));
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  jest.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  mockCapture.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  jest.useRealTimers();
});
async function mount() {
  const close = jest.fn();
  const check = jest.fn(async () => ({
    kind: 'unavailable' as const,
    creditedPoints: 0 as const,
  }));
  await act(async () =>
    root.render(<PhotoActivity onClose={close} check={check} />),
  );
  await act(async () => jest.runOnlyPendingTimers());
  return { close, check };
}
function button(label: string) {
  const result = [...host.querySelectorAll('button')].find(
    (b) => b.textContent === label,
  );
  expect(result).toBeDefined();
  return result!;
}

test('photo-first flow shows capture review, description, retake and close', async () => {
  const photo = {
    kind: 'photo' as const,
    base64: 'YWJj',
    mime: 'image/jpeg' as const,
  };
  mockCapture
    .mockResolvedValueOnce(photo)
    .mockResolvedValueOnce({ kind: 'cancelled' });
  const { close, check } = await mount();
  expect(host.textContent).toContain('Captured activity photo');
  expect(
    host.querySelector('input[aria-label="Activity description"]'),
  ).not.toBeNull();
  expect(button('Check activity').disabled).toBe(true);
  await act(async () => button('Retake photo').click());
  expect(photo.base64).toBe('');
  expect(close).toHaveBeenCalledTimes(1);
  expect(check).not.toHaveBeenCalled();
});
test('permission denial exposes settings and never checks the activity', async () => {
  mockCapture.mockResolvedValue({ kind: 'denied', canAskAgain: false });
  const { check } = await mount();
  expect(host.textContent).toContain('Allow camera access');
  expect(button('Open Settings').disabled).toBe(false);
  expect(check).not.toHaveBeenCalled();
});
test('closing releases retained photo and cancels the flow', async () => {
  const photo = {
    kind: 'photo' as const,
    base64: 'YWJj',
    mime: 'image/jpeg' as const,
  };
  mockCapture.mockResolvedValue(photo);
  const { close } = await mount();
  await act(async () => button('Close').click());
  expect(photo.base64).toBe('');
  expect(close).toHaveBeenCalledTimes(1);
});

function signedIn(id = 'A', token = 'old'): SessionState {
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
  let state = signedIn();
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: SessionState) {
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
}
async function describe() {
  const input = host.querySelector('input');
  if (!input) throw new Error('Missing description');
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set?.call(input, 'Took the bus');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
test('A to loading to A preserves photo/description and checks with the refreshed callback and token', async () => {
  const photo = {
    kind: 'photo' as const,
    base64: 'YWJj',
    mime: 'image/jpeg' as const,
  };
  mockCapture.mockResolvedValue(photo);
  const session = sessionSource();
  const owner = { accountId: 'A', profileId: 'A-profile' };
  const close = jest.fn();
  const first = jest.fn(async () => ({
    kind: 'unavailable' as const,
    creditedPoints: 0 as const,
  }));
  const latest = jest.fn(async () => ({
    kind: 'unavailable' as const,
    creditedPoints: 0 as const,
  }));
  await act(async () =>
    root.render(
      <PhotoActivitySession
        owner={owner}
        session={session}
        check={first}
        onClose={close}
      />,
    ),
  );
  await act(async () => jest.runOnlyPendingTimers());
  await describe();
  await act(async () => session.set({ kind: 'loading' }));
  expect(photo.base64).toBe('YWJj');
  expect(host.querySelector('input')?.value).toBe('Took the bus');
  expect(button('Check activity').disabled).toBe(true);
  await act(async () => button('Check activity').click());
  expect(first).not.toHaveBeenCalled();
  await act(async () => {
    session.set(signedIn('A', 'new'));
    root.render(
      <PhotoActivitySession
        owner={owner}
        session={session}
        check={latest}
        onClose={close}
      />,
    );
  });
  await act(async () => button('Check activity').click());
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledWith(
    'new',
    'A-profile',
    expect.any(AbortSignal),
  );
  expect(mockCapture).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  expect(photo.base64).toBe('');
});
test.each([
  ['switch', signedIn('B')],
  ['logout', { kind: 'signedOut', error: null }],
  ['expiry', { kind: 'signedOut', error: 'expired' }],
] satisfies [string, SessionState][])(
  '%s clears the retained photo and closes the flow',
  async (_label, next) => {
    const photo = {
      kind: 'photo' as const,
      base64: 'YWJj',
      mime: 'image/jpeg' as const,
    };
    mockCapture.mockResolvedValue(photo);
    const session = sessionSource();
    const close = jest.fn();
    await act(async () =>
      root.render(
        <PhotoActivitySession
          owner={{ accountId: 'A', profileId: 'A-profile' }}
          session={session}
          check={async () => ({ kind: 'unavailable', creditedPoints: 0 })}
          onClose={close}
        />,
      ),
    );
    await act(async () => jest.runOnlyPendingTimers());
    await act(async () => session.set(next));
    expect(photo.base64).toBe('');
    expect(close).toHaveBeenCalled();
    expect(host.textContent).toBe('');
  },
);
test('system camera result survives same-account loading without reopening', async () => {
  let resolve:
    ((photo: Awaited<ReturnType<typeof capturePhoto>>) => void) | undefined;
  mockCapture.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const session = sessionSource();
  const close = jest.fn();
  await act(async () =>
    root.render(
      <PhotoActivitySession
        owner={{ accountId: 'A', profileId: 'A-profile' }}
        session={session}
        check={async () => ({ kind: 'unavailable', creditedPoints: 0 })}
        onClose={close}
      />,
    ),
  );
  await act(async () => jest.runOnlyPendingTimers());
  await act(async () => {
    session.set({ kind: 'loading' });
    resolve?.({ kind: 'photo', base64: 'YWJj', mime: 'image/jpeg' });
  });
  await act(async () => session.set(signedIn()));
  expect(host.textContent).toContain('Captured activity photo');
  expect(mockCapture).toHaveBeenCalledTimes(1);
});

test('account switch cancels an in-flight check and ignores its late response', async () => {
  const photo = {
    kind: 'photo' as const,
    base64: 'YWJj',
    mime: 'image/jpeg' as const,
  };
  mockCapture.mockResolvedValue(photo);
  const session = sessionSource();
  const close = jest.fn();
  let signal: AbortSignal | undefined;
  let finish:
    ((value: { kind: 'unavailable'; creditedPoints: 0 }) => void) | undefined;
  const check = (_token: string, _profile: string, current: AbortSignal) => {
    signal = current;
    return new Promise<{ kind: 'unavailable'; creditedPoints: 0 }>(
      (resolve) => {
        finish = resolve;
      },
    );
  };
  await act(async () =>
    root.render(
      <PhotoActivitySession
        owner={{ accountId: 'A', profileId: 'A-profile' }}
        session={session}
        check={check}
        onClose={close}
      />,
    ),
  );
  await act(async () => jest.runOnlyPendingTimers());
  await describe();
  await act(async () => button('Check activity').click());
  await act(async () => session.set(signedIn('B')));
  expect(signal?.aborted).toBe(true);
  expect(photo.base64).toBe('');
  await act(async () => finish?.({ kind: 'unavailable', creditedPoints: 0 }));
  expect(host.textContent).toBe('');
  expect(close).toHaveBeenCalled();
});

test('logout while the camera is open discards its late capture', async () => {
  let resolve:
    ((photo: Awaited<ReturnType<typeof capturePhoto>>) => void) | undefined;
  mockCapture.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const session = sessionSource();
  const close = jest.fn();
  await act(async () =>
    root.render(
      <PhotoActivitySession
        owner={{ accountId: 'A', profileId: 'A-profile' }}
        session={session}
        check={async () => ({ kind: 'unavailable', creditedPoints: 0 })}
        onClose={close}
      />,
    ),
  );
  await act(async () => jest.runOnlyPendingTimers());
  await act(async () => session.set({ kind: 'signedOut', error: null }));
  const photo = {
    kind: 'photo' as const,
    base64: 'YWJj',
    mime: 'image/jpeg' as const,
  };
  await act(async () => resolve?.(photo));
  expect(photo.base64).toBe('');
  expect(host.textContent).toBe('');
});

async function mountHomeOwner() {
  const initial = signedIn();
  if (initial.kind !== 'signedIn') throw new Error('Fixture');
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
        check={photo.check}
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
  return { session, api };
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
  const { session, api } = await mountHomeOwner();
  await describe();
  const state = session.getState();
  if (state.kind !== 'signedIn') throw new Error('Fixture');
  let complete: (() => void) | undefined;
  api.resume = () =>
    new Promise((resolve) => {
      complete = () => resolve(state.account);
    });
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = session.resume();
  });
  expect(host.querySelector('input')?.value).toBe('Took the bus');
  expect(button('Check activity').disabled).toBe(true);
  await act(async () => {
    complete?.();
    await pending;
  });
  expect(host.querySelector('input')?.value).toBe('Took the bus');
  expect(mockCapture).toHaveBeenCalledTimes(1);
  await act(async () => mockBlur?.());
  expect(photo.base64).toBe('');
  expect(button('Photo activity').disabled).toBe(false);
});
