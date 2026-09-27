import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createEmailFlow } from '../src/features/account/email-flow';
import {
  createSessionController,
  type StoredSession,
} from '../src/features/account/session';
import type { AccountApi } from '../src/features/account/api';
import { Onboarding } from '../src/features/onboarding/Onboarding';

let mockState: { kind: string; account?: { id: string }; token?: string };
let mockReducedMotion = true;
const mockRead = jest.fn<(key: string) => Promise<string | null>>();
const mockWrite = jest.fn<(key: string, value: string) => Promise<void>>();
const mockRename = jest.fn<(name: string) => Promise<void>>();
jest.mock('../src/features/account/provider', () => ({
  useAccount: () => ({
    state: mockState,
    controller: { rename: mockRename, getState: () => mockState },
  }),
}));
jest.mock('../src/features/account/storage', () => ({
  privateStorage: {
    read: (key: string) => mockRead(key),
    write: (key: string, value: string) => mockWrite(key, value),
  },
}));
jest.mock('../src/features/account/AccountPanel', () => ({
  AccountPanel: () => <button>Account</button>,
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
  View: ({
    children,
    accessibilityValue,
  }: {
    children: React.ReactNode;
    accessibilityValue?: { now: number };
  }) => <div data-progress={accessibilityValue?.now}>{children}</div>,
  ScrollView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TextInput: ({
    value,
    onChangeText,
  }: {
    value: string;
    onChangeText: (value: string) => void;
  }) => (
    <input
      aria-label="Name"
      value={value}
      onInput={(event) => onChangeText(event.currentTarget.value)}
    />
  ),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: () => <div /> },
  useReducedMotion: () => mockReducedMotion,
  cubicBezier: (...values: number[]) => values,
}));
jest.mock('lucide-react-native', () => ({
  Route: () => null,
  Gift: () => null,
  Leaf: () => null,
}));
let root: Root;
let element: HTMLDivElement;
let mounts = 0;
function AppFixture() {
  React.useEffect(() => {
    mounts++;
  }, []);
  return <p>App content</p>;
}
async function render() {
  await act(async () => {
    root.render(
      <Onboarding>
        <AppFixture />
      </Onboarding>,
    );
  });
}
async function click(label: string) {
  const button = [...element.querySelectorAll('button')].find(
    (item) => item.textContent === label,
  );
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => {
    button.click();
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockState = { kind: 'signedOut' };
  mockReducedMotion = true;
  mockRead.mockReset().mockResolvedValue(null);
  mockWrite.mockReset().mockResolvedValue(undefined);
  mockRename.mockReset().mockResolvedValue(undefined);
  mounts = 0;
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
});
afterEach(() => {
  act(() => root.unmount());
  jest.useRealTimers();
  element.remove();
});
test('walkthrough moves back and forward, persists introduction, and permits guest browsing', async () => {
  await render();
  expect(element.textContent).toContain('Make your journey count');
  await click('Next');
  expect(element.textContent).toContain('Choose your reward');
  await click('Back');
  expect(element.textContent).toContain('Make your journey count');
  await click('Next');
  await click('Next');
  await click('Continue');
  expect(mockWrite).toHaveBeenCalledWith(
    'amr.onboarding.introduction.v1',
    'done',
  );
  await click('Browse first');
  expect(element.textContent).toContain('App content');
});
test('completed onboarding keeps the app mounted during refresh and logout', async () => {
  mockRead.mockResolvedValue('done');
  mockState = { kind: 'signedIn', account: { id: 'a' }, token: 'one' };
  await render();
  expect(mounts).toBe(1);
  expect(element.querySelector('[data-progress]')).toBeNull();
  mockState = { kind: 'loading' };
  await render();
  expect(element.textContent).toContain('App content');
  mockState = { kind: 'signedIn', account: { id: 'a' }, token: 'two' };
  await render();
  mockState = { kind: 'signedOut' };
  await render();
  expect(element.textContent).toContain('App content');
  expect(mounts).toBe(1);
});
test.each([true, false])(
  'saving a name keeps completed progress visible before entry (reduced motion: %s)',
  async (reducedMotion) => {
    jest.useFakeTimers();
    mockReducedMotion = reducedMotion;
    mockRead.mockImplementation(async (key) =>
      key.includes('introduction') ? 'done' : null,
    );
    mockState = { kind: 'signedIn', account: { id: 'a' }, token: 'one' };
    await render();
    await click('Save and continue');
    expect(mockRename).not.toHaveBeenCalled();
    const input = element.querySelector('input');
    if (!input) throw new Error('Name input absent');
    await act(async () => {
      input.value = 'Fan Name';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click('Save and continue');
    expect(mockRename).toHaveBeenCalledWith('Fan Name');
    expect(mockWrite).toHaveBeenCalledWith('amr.onboarding.account.a', 'done');
    expect(element.querySelector('[data-progress="5"]')).not.toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(219);
    });
    expect(element.querySelector('[data-progress="5"]')).not.toBeNull();
    expect(element.textContent).toContain('Setup complete');
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(element.textContent).toContain('App content');
  },
);

test('guest browsing still asks a newly signed-in account for its name', async () => {
  mockRead.mockImplementation(async (key) =>
    key.includes('introduction') ? 'done' : null,
  );
  await render();
  await click('Browse first');
  mockState = { kind: 'signedIn', account: { id: 'new' }, token: 'new-token' };
  await render();
  expect(element.textContent).toContain('What should we call you?');
});

test('unfinished name survives same-account foreground refresh but clears for another account', async () => {
  mockRead.mockImplementation(async (key) =>
    key.includes('introduction') ? 'done' : null,
  );
  mockState = { kind: 'signedIn', account: { id: 'a' }, token: 'one' };
  await render();
  const input = element.querySelector('input');
  if (!input) throw new Error('Name absent');
  await act(async () => {
    input.value = 'Draft Name';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  mockState = { kind: 'loading' };
  await render();
  mockState = { kind: 'signedIn', account: { id: 'a' }, token: 'two' };
  await render();
  expect(element.querySelector('input')?.value).toBe('Draft Name');
  mockState = { kind: 'signedIn', account: { id: 'b' }, token: 'three' };
  await render();
  expect(element.querySelector('input')?.value).toBe('');
});

test('immediate password signup persists provider and app sessions then enters name setup', async () => {
  mockRead.mockImplementation(async (key) =>
    key.includes('introduction') ? 'done' : null,
  );
  await render();
  const account = {
    id: 'new-fan',
    role: 'fan' as const,
    profiles: [
      { id: 'real', kind: 'real' as const, displayName: 'Fan', balance: 0 },
      { id: 'demo', kind: 'demo' as const, displayName: 'Fan', balance: 0 },
    ],
  };
  const api: AccountApi = {
    signIn: jest.fn(async () => ({
      token: 'app-session',
      expiresAt: '2030-01-01',
      account,
    })),
    syntheticSignIn: async () => {
      throw new Error('Unused');
    },
    resume: async () => account,
    logout: async () => {},
    rename: async () => account.profiles[0],
    history: async () => ({
      profile: account.profiles[0],
      balance: 0,
      entries: [],
      nextCursor: null,
    }),
  };
  let stored: StoredSession | null = null;
  const controller = createSessionController(api, {
    read: async () => stored,
    write: async (value) => {
      stored = value;
    },
    clear: async () => {
      stored = null;
    },
  });
  const provider = {
    accessToken: 'provider-access',
    refreshToken: 'provider-refresh',
    expiresAt: 2000000000000,
    subject: '11111111-1111-4111-8111-111111111111',
  };
  const auth = {
    signUp: jest.fn(async () => ({ kind: 'session' as const, provider })),
    signIn: async () => provider,
    refresh: async () => provider,
    revoke: async () => {},
  };
  await controller.signIn(() =>
    createEmailFlow(auth, api).authenticate(
      'signUp',
      'fixture@example.test',
      'fixture-password',
    ),
  );
  expect(api.signIn).toHaveBeenCalledWith('provider-access');
  expect(stored).toMatchObject({
    kind: 'active',
    token: 'app-session',
    provider: {
      accessToken: 'provider-access',
      refreshToken: 'provider-refresh',
    },
  });
  mockState = controller.getState();
  await render();
  expect(element.textContent).toContain('What should we call you?');
  expect(element.textContent).not.toContain('App content');
  expect(element.textContent).not.toContain('Confirm email');
});

test('numbered setup includes introduction, account and name without suggesting step three is final', async () => {
  await render();
  expect(element.textContent).toContain('Step 1 of 5');
  await click('Next');
  expect(element.textContent).toContain('Step 2 of 5');
  await click('Next');
  expect(element.textContent).toContain('Step 3 of 5');
  await click('Continue');
  expect(element.textContent).toContain('Step 4 of 5');
  mockState = { kind: 'signedIn', account: { id: 'new' }, token: 'one' };
  await render();
  expect(element.textContent).toContain('Step 5 of 5');
});
