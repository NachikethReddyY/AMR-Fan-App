import React, {
  act,
  useEffect as mockUseEffect,
  useSyncExternalStore as mockUseSyncExternalStore,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { Home } from '../src/features/home/Home';
import {
  createSessionController,
  type StoredSession,
} from '../src/features/account/session';
import type { AccountApi } from '../src/features/account/api';
const mockAccount = {
  id: 'fan',
  role: 'fan' as const,
  profiles: [
    { id: 'real', kind: 'real' as const, displayName: 'Fan', balance: 55 },
    {
      id: 'saved',
      kind: 'demo' as const,
      displayName: 'Saved sample',
      balance: 875,
    },
  ],
};
let mockStored: StoredSession | null = null;
const mockApi: AccountApi = {
  resume: async () => mockAccount,
  signIn: async () => {
    throw new Error('unused');
  },
  syntheticSignIn: async () => {
    throw new Error('unused');
  },
  logout: async () => {},
  rename: async () => {
    throw new Error('unused');
  },
  history: async () => {
    throw new Error('unused');
  },
};
const mockController = createSessionController(mockApi, {
  read: async () => mockStored,
  write: async (value) => {
    mockStored = value;
  },
  clear: async () => {
    mockStored = null;
  },
});
const mockRefresh = jest.fn(async () => {});
const mockPhoto = jest.fn();
jest.mock('../src/features/account/provider', () => ({
  useAccount: () => ({
    controller: mockController,
    state: mockUseSyncExternalStore(
      mockController.subscribe,
      mockController.getState,
    ),
  }),
}));
jest.mock('../src/features/points/provider', () => ({
  useHistory: () => ({ controller: { refresh: mockRefresh } }),
}));
jest.mock('../src/features/points/Balance', () => ({
  Balance: () => <span>Loading balance…</span>,
}));
jest.mock('../src/features/activity/usePhotoActivity', () => ({
  usePhotoActivity: () => ({ owner: null, canOpen: true, open: mockPhoto }),
}));
jest.mock('../src/features/activity/PhotoActivitySession', () => ({
  PhotoActivitySession: () => null,
}));
jest.mock('../src/features/impact/useContributions', () => ({
  useContributions: () => ({ state: { kind: 'loading' } }),
}));
jest.mock('../src/features/impact/presentation', () => ({
  contributionText: () => 'Loading impact…',
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (fn: () => void) => mockUseEffect(fn, [fn]),
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (s: unknown) => s },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pressable: ({
    children,
    onPress,
    accessibilityLabel,
    disabled,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    accessibilityLabel?: string;
    disabled?: boolean;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  ),
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
    <button disabled={disabled} onClick={onPress}>
      {label}
    </button>
  ),
}));
jest.mock('lucide-react-native', () => ({
  ArrowRight: () => null,
  ChevronRight: () => null,
  Camera: () => null,
  Route: () => null,
}));
let root: Root;
let host: HTMLDivElement;
const travel = jest.fn();
const rewards = jest.fn();
const history = jest.fn();
const impact = jest.fn();
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(
    (b) => b.textContent === label || b.getAttribute('aria-label') === label,
  );
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => button.click());
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await mockController.signIn(async () => ({
    account: mockAccount,
    token: 'fixture',
    expiresAt: '2030-01-01',
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <Home
        onTravel={travel}
        onRewards={rewards}
        onHistory={history}
        onImpact={impact}
      />,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  jest.clearAllMocks();
});
test('selected A keeps real unloaded balance first and gives rewards/history/photo/plan distinct working entries', async () => {
  expect(host.textContent?.indexOf('Loading balance')).toBeLessThan(
    host.textContent?.indexOf('Photo activity') ?? 0,
  );
  expect(host.textContent).not.toContain('1,250');
  await click('View rewards');
  await click('History');
  await click('Photo activity');
  await click('Plan a journey');
  expect(rewards).toHaveBeenCalledTimes(1);
  expect(history).toHaveBeenCalledTimes(1);
  expect(travel).toHaveBeenCalledTimes(1);
  expect(mockPhoto).toHaveBeenCalledTimes(1);
});
test('illustrative view never changes account selection or saved records, and explicit saved-data entry remains available', async () => {
  const before = mockController.getState();
  await click('View test data');
  expect(host.textContent).toContain('1,250 example points');
  expect(host.textContent).toContain('30 kg example CO₂ reduction');
  expect(host.textContent).toContain('Examples only');
  expect(mockController.getState()).toEqual(before);
  await click('Return to real data');
  expect(host.textContent).toContain('Loading balance');
  expect(mockController.getState()).toEqual(before);
  await click('View test data');
  await click('Use saved test data');
  expect(mockController.getState()).toMatchObject({
    selected: 'demo',
    account: mockAccount,
  });
  expect(mockStored).toMatchObject({ selected: 'demo' });
  await click('View test data');
  await click('Back to Home');
  expect(mockController.getState()).toMatchObject({ selected: 'demo' });
  await click('View test data');
  await click('Return to real data');
  expect(mockController.getState()).toMatchObject({
    selected: 'real',
    account: mockAccount,
  });
});

test('persisted saved test data stays visibly labelled until an explicit successful return', async () => {
  await act(async () => mockController.select('demo'));
  await act(async () => mockController.resume());
  expect(host.textContent).toContain('Saved test profile');
  expect(mockStored).toMatchObject({ selected: 'demo' });
  const selection = jest
    .spyOn(mockController, 'select')
    .mockRejectedValueOnce(new Error('fixture write failed'));
  await click('Return to real data');
  expect(host.textContent).toContain('Could not return to real data');
  expect(mockController.getState()).toMatchObject({
    selected: 'demo',
    account: mockAccount,
  });
  selection.mockRestore();
  await click('Return to real data');
  expect(host.textContent).not.toContain('Saved test profile');
  expect(mockController.getState()).toMatchObject({
    selected: 'real',
    account: mockAccount,
  });
});
