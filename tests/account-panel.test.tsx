import React, {
  act,
  useSyncExternalStore as mockUseSyncExternalStore,
} from 'react';
import { createRoot } from 'react-dom/client';
import { expect, jest, test } from '@jest/globals';
import { AccountPanel } from '../src/features/account/AccountPanel';
import { createSessionController } from '../src/features/account/session';
import type { AccountApi, Session } from '../src/features/account/api';

const mockSession: Session = {
  token: 'app-session',
  expiresAt: '2030-01-01',
  account: {
    id: 'fan',
    role: 'fan',
    profiles: [
      { id: 'real', kind: 'real', displayName: 'Fan', balance: 0 },
      { id: 'demo', kind: 'demo', displayName: 'Fan', balance: 0 },
    ],
  },
};
const mockApi: AccountApi = {
  signIn: async () => mockSession,
  syntheticSignIn: async () => mockSession,
  resume: async () => mockSession.account,
  logout: async () => {},
  rename: async () => mockSession.account.profiles[0],
  history: async () => ({
    profile: mockSession.account.profiles[0],
    balance: 0,
    entries: [],
    nextCursor: null,
  }),
};
const mockController = createSessionController(mockApi, {
  read: async () => null,
  write: async () => {},
  clear: async () => {},
});
const mockAuthenticate = jest.fn<() => Promise<Session>>();
jest.mock('../src/features/account/provider', () => ({
  useAccount: () => ({
    controller: mockController,
    state: mockUseSyncExternalStore(
      mockController.subscribe,
      mockController.getState,
    ),
  }),
}));
jest.mock('../src/features/account/native-auth', () => ({
  api: mockApi,
  localSignInEnabled: false,
  syntheticEmailAuth: false,
  authenticateEmail: () => mockAuthenticate(),
}));
jest.mock('../src/features/points/provider', () => ({
  useHistory: () => ({ controller: { refresh: async () => {} } }),
}));
jest.mock('../src/features/points/Balance', () => ({ Balance: () => null }));
jest.mock('react-native', () => ({
  AccessibilityInfo: {
    isBoldTextEnabled: async () => false,
    addEventListener: () => ({ remove: () => {} }),
    sendAccessibilityEvent: () => {},
  },
  useWindowDimensions: () => ({ fontScale: 1 }),
  StyleSheet: { create: (s: unknown) => s },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Modal: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? <section>{children}</section> : null),
  Text: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  Pressable: ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    accessibilityLabel?: string;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
  TextInput: ({
    accessibilityLabel,
    value,
    onChangeText,
  }: {
    accessibilityLabel: string;
    value: string;
    onChangeText: (value: string) => void;
  }) => (
    <input
      aria-label={accessibilityLabel}
      value={value}
      onInput={(e) => onChangeText(e.currentTarget.value)}
    />
  ),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('lucide-react-native', () => ({
  UserRound: () => null,
  X: () => null,
  Pencil: () => null,
  ChevronDown: () => null,
  ChevronRight: () => null,
}));

test('password signup closes the real Account sheet so onboarding can show the name step; cancelled late completion cannot close a reopened sheet', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await mockController.resume();
  mockAuthenticate.mockResolvedValue(mockSession);
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  const changed = jest.fn<(open: boolean) => void>();
  async function click(label: string) {
    const button = [...element.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === label || b.textContent === label,
    );
    if (!button) throw new Error(`Missing ${label}`);
    await act(async () => button.click());
  }
  async function fill(label: string, value: string) {
    const input = element.querySelector<HTMLInputElement>(
      `input[aria-label="${label}"]`,
    );
    if (!input) throw new Error(`Missing ${label}`);
    await act(async () => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  try {
    await act(async () => root.render(<AccountPanel onOpenChange={changed} />));
    await click('Log in');
    await click('Create an account');
    await fill('Email', 'fixture@example.test');
    await fill('Password', 'fixture-password');
    await click('Create account');
    expect(mockController.getState()).toMatchObject({
      kind: 'signedIn',
      token: 'app-session',
    });
    expect(changed).toHaveBeenLastCalledWith(false);
    expect(element.querySelector('section')).toBeNull();
    await act(async () => mockController.logout());
    let resolveLate: (session: Session) => void = () => {};
    mockAuthenticate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLate = resolve;
        }),
    );
    await click('Log in');
    await fill('Password', 'fixture-password');
    await click('Sign in with email');
    await click('Close account');
    await click('Log in');
    await act(async () => {
      resolveLate(mockSession);
    });
    expect(changed).toHaveBeenLastCalledWith(true);
    expect(element.querySelector('section')).not.toBeNull();
    expect(mockController.getState()).toMatchObject({ kind: 'signedOut' });
  } finally {
    await act(async () => root.unmount());
    element.remove();
  }
});

test('Log in and Sign up are separate entry actions and each opens the requested form', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await mockController.resume();
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  async function click(label: string) {
    const button = [...element.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === label || b.textContent === label,
    );
    if (!button) throw new Error(`Missing ${label}`);
    await act(async () => button.click());
  }
  try {
    await act(async () => root.render(<AccountPanel />));
    expect(element.textContent).toContain('Log in');
    expect(element.textContent).toContain('Sign up');
    await click('Sign up');
    expect(element.querySelector('section')?.textContent).toContain(
      'Create account',
    );
    const email = element.querySelector<HTMLInputElement>(
      'input[aria-label="Email"]',
    );
    if (!email) throw new Error('Email field absent');
    await act(async () => {
      email.value = 'draft@example.test';
      email.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click('Close account');
    await click('Log in');
    expect(
      element.querySelector<HTMLInputElement>('input[aria-label="Email"]')
        ?.value,
    ).toBe('draft@example.test');
    expect(element.querySelector('section')?.textContent).toContain(
      'Sign in with email',
    );
    expect(element.querySelector('section')?.textContent).not.toContain(
      'Choose an email',
    );
  } finally {
    await act(async () => root.unmount());
    element.remove();
  }
});
