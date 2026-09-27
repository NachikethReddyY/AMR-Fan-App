import React, {
  act,
  useSyncExternalStore as mockUseSyncExternalStore,
} from 'react';
import { createRoot } from 'react-dom/client';
import { expect, jest, test } from '@jest/globals';
import { AccountEditError } from '../src/features/account/supabase';
import { createEmailFlow } from '../src/features/account/email-flow';
import { AccountPanel } from '../src/features/account/AccountPanel';
import {
  createSessionController,
  type StoredSession,
} from '../src/features/account/session';
import type { AccountApi, Session } from '../src/features/account/api';

const mockSession: Session = {
  token: 'app-session',
  expiresAt: '2030-01-01',
  account: {
    id: 'fan',
    role: 'fan',
    profiles: [
      { id: 'real', kind: 'real', displayName: 'Fan', balance: 0 },
      { id: 'demo', kind: 'demo', displayName: 'Sample Fan', balance: 1250 },
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
let mockStored: StoredSession | null = null;
const mockController = createSessionController(mockApi, {
  read: async () => mockStored,
  write: async (value) => {
    mockStored = value;
  },
  clear: async () => {
    mockStored = null;
  },
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

test('confirmation guidance keeps the signup sheet and email draft, clears the password and never signs in or resends', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await mockController.cancelSignIn();
  const signUp = jest.fn(async () => ({
    kind: 'confirmation' as const,
    email: 'fixture@example.test',
  }));
  const signIn = jest.fn(async () => mockSession);
  const flow = createEmailFlow(
    {
      signUp,
      signIn: async () => {
        throw new Error('unused');
      },
      revoke: async () => {},
    },
    { signIn },
  );
  mockAuthenticate.mockImplementationOnce(() =>
    flow.authenticate('signUp', 'fixture@example.test', 'fixture-password'),
  );
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
    await click('Sign up');
    await fill('Email', 'fixture@example.test');
    await fill('Password', 'fixture-password');
    await click('Create account');
    expect(element.textContent).toContain(
      'Check your email. If you received a confirmation link, open it, then return here to sign in.',
    );
    expect(element.querySelector('section')).not.toBeNull();
    expect(
      element.querySelector<HTMLInputElement>('input[aria-label="Email"]')
        ?.value,
    ).toBe('fixture@example.test');
    expect(
      element.querySelector<HTMLInputElement>('input[aria-label="Password"]')
        ?.value,
    ).toBe('');
    expect(changed).toHaveBeenLastCalledWith(true);
    expect(mockController.getState().kind).toBe('signedOut');
    expect(mockStored).toBeNull();
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signIn).not.toHaveBeenCalled();
    expect(element.textContent).not.toMatch(/resend|enter.*code/i);
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

test('account email edit reports pending verification and preserves real identity while test data is selected', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await mockController.signIn(async () => mockSession);
  await mockController.select('demo');
  const read = jest
    .spyOn(mockController, 'readAccountDetails')
    .mockResolvedValue({ email: 'old@example.test', pendingEmail: null });
  const update = jest.spyOn(mockController, 'updateAccount').mockResolvedValue({
    email: 'old@example.test',
    pendingEmail: 'new@example.test',
  });
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  async function click(label: string) {
    const b = [...element.querySelectorAll('button')].find(
      (b) => b.textContent === label || b.getAttribute('aria-label') === label,
    );
    if (!b) throw new Error(`Missing ${label}`);
    await act(async () => b.click());
  }
  try {
    await act(async () => root.render(<AccountPanel />));
    await click('Fan, account');
    expect(element.textContent).toContain('old@example.test');
    expect(element.textContent).not.toContain('Sample Fan');
    await click('Account settings');
    expect(element.textContent).not.toContain('Use sample profile');
    expect(element.textContent).not.toContain('Return to real data');
    await click('Edit email');
    const input = element.querySelector<HTMLInputElement>(
      'input[aria-label="New email"]',
    );
    if (!input) throw new Error('Missing New email');
    await act(async () => {
      input.value = 'new@example.test';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => mockController.resume());
    expect(
      element.querySelector<HTMLInputElement>('input[aria-label="New email"]')
        ?.value,
    ).toBe('new@example.test');
    await click('Back to account');
    await click('Edit email');
    expect(
      element.querySelector<HTMLInputElement>('input[aria-label="New email"]')
        ?.value,
    ).toBe('new@example.test');
    await click('Save email');
    expect(update).toHaveBeenCalledWith({
      kind: 'email',
      email: 'new@example.test',
    });
    expect(element.textContent).toContain('Confirmation pending');
    expect(element.textContent).toContain('old@example.test');
    expect(mockController.getState()).toMatchObject({
      selected: 'demo',
      account: { id: 'fan' },
    });
    expect(element.textContent).not.toContain('Setup progress');
  } finally {
    await act(async () => root.unmount());
    element.remove();
    read.mockRestore();
    update.mockRestore();
  }
});

test('foreground resume preserves verification step but clears secrets; logout and account switch discard drafts', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await mockController.signIn(async () => mockSession);
  const details = { email: 'fan@example.test', pendingEmail: null };
  const read = jest
    .spyOn(mockController, 'readAccountDetails')
    .mockResolvedValue(details);
  const update = jest
    .spyOn(mockController, 'updateAccount')
    .mockRejectedValueOnce(
      new AccountEditError(
        'reauthenticationRequired',
        'Send a code to continue.',
      ),
    )
    .mockResolvedValue(details);
  const code = jest
    .spyOn(mockController, 'requestAccountCode')
    .mockResolvedValue(undefined);
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  async function click(label: string) {
    const b = [...element.querySelectorAll('button')].find(
      (b) => b.textContent === label || b.getAttribute('aria-label') === label,
    );
    if (!b) throw new Error(`Missing ${label}`);
    await act(async () => b.click());
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
    await act(async () => root.render(<AccountPanel />));
    await click('Fan, account');
    await click('Change password');
    await fill('Current password', 'old-password');
    await fill('New password', 'new-password');
    await click('Save password');
    expect(code).not.toHaveBeenCalled();
    await click('Send verification code');
    expect(code).toHaveBeenCalledTimes(1);
    await fill('Current password', 'discard-background');
    await fill('New password', 'discard-background');
    await fill('Verification code', '111111');
    await act(async () => mockController.resume());
    for (const label of [
      'Current password',
      'New password',
      'Verification code',
    ])
      expect(
        element.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)
          ?.value,
      ).toBe('');
    await fill('Current password', 'discard-background');
    await fill('New password', 'discard-background');
    await fill('Verification code', '111111');
    let resumeDone: () => void = () => {};
    const resumed = new Promise<void>((resolve) => {
      resumeDone = resolve;
    });
    const resume = jest
      .spyOn(mockApi, 'resume')
      .mockImplementationOnce(async () => {
        await resumed;
        return mockSession.account;
      });
    let foreground: Promise<void> = Promise.resolve();
    await act(async () => {
      foreground = mockController.resume();
    });
    expect(
      element.querySelector('input[aria-label="New password"]'),
    ).toBeNull();
    await act(async () => {
      resumeDone();
      await foreground;
    });
    resume.mockRestore();
    expect(
      element.querySelector('input[aria-label="Verification code"]'),
    ).not.toBeNull();
    for (const label of [
      'Current password',
      'New password',
      'Verification code',
    ])
      expect(
        element.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)
          ?.value,
      ).toBe('');
    expect(code).toHaveBeenCalledTimes(1);
    await fill('Current password', 'old-password');
    await fill('New password', 'new-password');
    await fill('Verification code', '123456');
    await click('Save password');
    expect(update).toHaveBeenLastCalledWith({
      kind: 'password',
      currentPassword: 'old-password',
      password: 'new-password',
      nonce: '123456',
    });
    expect(element.textContent).toContain('Password updated.');
    await click('Change password');
    await fill('New password', 'discard-this');
    await click('Close account');
    await click('Fan, account');
    await click('Change password');
    expect(
      element.querySelector<HTMLInputElement>(
        'input[aria-label="New password"]',
      )?.value,
    ).toBe('');
    update.mockRejectedValueOnce(
      new AccountEditError(
        'reauthenticationRequired',
        'Send a code to continue.',
      ),
    );
    await fill('Current password', 'old-password');
    await fill('New password', 'new-password');
    await click('Save password');
    expect(
      element.querySelector('input[aria-label="Verification code"]'),
    ).not.toBeNull();
    await act(async () => mockController.logout());
    await act(async () => mockController.signIn(async () => mockSession));
    // Even returning to the identical account/token cannot resurrect a logged-out draft.
    expect(
      element.querySelector('input[aria-label="Verification code"]'),
    ).toBeNull();
    expect(
      element.querySelector('input[aria-label="New password"]'),
    ).toBeNull();
    await click('Edit email');
    await fill('New email', 'private-draft@example.test');
    await act(async () =>
      mockController.signIn(async () => ({
        ...mockSession,
        token: 'other-session',
        account: { ...mockSession.account, id: 'other-fan' },
      })),
    );
    expect(element.querySelector('input[aria-label="New email"]')).toBeNull();
    await click('Edit email');
    expect(
      element.querySelector<HTMLInputElement>('input[aria-label="New email"]')
        ?.value,
    ).toBe('fan@example.test');
  } finally {
    await act(async () => root.unmount());
    element.remove();
    read.mockRestore();
    update.mockRestore();
    code.mockRestore();
  }
});
