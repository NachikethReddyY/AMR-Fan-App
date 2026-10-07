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
import type { Mission, MissionsResponse } from '../src/features/missions/api';
const mockMissionId = '00000000-0000-4000-8000-000000000011';
const mockMission: Mission = {
  id: mockMissionId,
  slug: 'cleanup-race-week',
  title: 'Clean up the paddock',
  category: 'cleanup' as const,
  kind: 'race_week' as const,
  target: 3,
  communityTarget: 10,
  policyVersion: 'activity-reward-v1',
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2030-01-01T00:00:00.000Z',
  timezone: 'UTC',
  status: 'active' as const,
  version: 1,
  availability: 'active' as const,
  progress: { kind: 'not_enrolled' as const, count: 0 as const },
  communityProgress: 2,
  attribution: { sourceLabel: 'AMR sustainability team' },
};
let mockMissionProgress: Mission['progress'] = {
  kind: 'not_enrolled',
  count: 0,
};
let mockEnrollmentError = false;
let mockPhotoOwner: { accountId: string; profileId: string } | null = null;
const mockMissionsApi = {
  list: jest.fn(
    async (
      _token: string,
      _profileId: string,
      _signal: AbortSignal,
    ): Promise<MissionsResponse> => ({
      kind: 'available' as const,
      missions: [{ ...mockMission, progress: mockMissionProgress }],
      recommendedMissionId: mockMissionId,
    }),
  ),
  enroll: jest.fn(async () => {
    if (mockEnrollmentError) throw new Error('fixture enrollment failure');
    mockMissionProgress = { kind: 'enrolled', count: 0 };
    return {
      kind: 'enrolled' as const,
      missionId: mockMissionId,
      version: 1,
    };
  }),
};
jest.mock('../src/features/missions/api', () => ({
  createMissionsApi: () => mockMissionsApi,
}));
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
  usePhotoActivity: () => ({
    owner: mockPhotoOwner,
    canOpen: true,
    open: mockPhoto,
  }),
}));
jest.mock('../src/features/activity/PhotoActivitySession', () => ({
  PhotoActivitySession: ({ missionId }: { missionId: string | null }) => (
    <span>Selected activity mission: {missionId ?? 'none'}</span>
  ),
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
function renderHome() {
  return root.render(
    <Home
      onTravel={travel}
      onRewards={rewards}
      onHistory={history}
      onImpact={impact}
    />,
  );
}
function buttonByText(label: string) {
  const result = [...host.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  expect(result).toBeDefined();
  return result!;
}
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(
    (b) => b.textContent === label || b.getAttribute('aria-label') === label,
  );
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => button.click());
}
beforeEach(async () => {
  mockMissionProgress = { kind: 'not_enrolled', count: 0 };
  mockEnrollmentError = false;
  mockPhotoOwner = null;
  mockMissionsApi.list.mockClear();
  mockMissionsApi.list.mockImplementation(
    async (): Promise<MissionsResponse> => ({
      kind: 'available',
      missions: [{ ...mockMission, progress: mockMissionProgress }],
      recommendedMissionId: mockMissionId,
    }),
  );
  mockMissionsApi.enroll.mockClear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await mockController.signIn(async () => ({
    account: mockAccount,
    token: 'fixture',
    expiresAt: '2030-01-01',
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => renderHome());
  await act(async () => await Promise.resolve());
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

test('real profile mission list shows attribution, progress, and enrollment action', async () => {
  expect(host.textContent).toContain('Missions');
  expect(host.textContent).toContain('Clean up the paddock');
  expect(host.textContent).toContain('Race week · 0 of 3');
  expect(host.textContent).toContain('AMR sustainability team');
  const enroll = [...host.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === 'Enroll',
  );
  expect(enroll).toBeDefined();
  await act(async () => enroll?.click());
  expect(mockMissionsApi.enroll).toHaveBeenCalledWith(
    'fixture',
    mockMissionId,
    'real',
    expect.any(AbortSignal),
  );
  expect(host.textContent).toContain('Use this mission');
});

test('signed-out mission state prompts sign-in without an empty count', async () => {
  mockMissionsApi.list.mockClear();
  await act(async () => mockController.logout());
  await act(async () => renderHome());
  expect(host.textContent).toContain('Sign in to view missions.');
  expect(host.textContent).not.toContain('No missions available right now.');
  expect(mockMissionsApi.list).not.toHaveBeenCalled();
});

test('enrollment failures remain visible and do not select the mission', async () => {
  mockEnrollmentError = true;
  await act(async () => renderHome());
  await act(async () => buttonByText('Enroll').click());
  await act(async () => await Promise.resolve());
  expect(host.textContent).toContain('Could not enroll. Try again.');
  expect(host.textContent).not.toContain('Use this mission');
});

test('selecting an enrolled mission passes its ID into the photo activity session', async () => {
  mockMissionProgress = { kind: 'enrolled', count: 1 };
  mockMissionsApi.list.mockResolvedValue({
    kind: 'available',
    missions: [{ ...mockMission, progress: mockMissionProgress }],
    recommendedMissionId: mockMissionId,
  });
  await act(async () =>
    mockController.signIn(async () => ({
      account: mockAccount,
      token: 'mission-fixture-token',
      expiresAt: '2030-01-01',
    })),
  );
  const useMission = buttonByText('Use this mission');
  await act(async () => useMission.click());
  expect(mockMissionsApi.enroll).not.toHaveBeenCalled();
  mockPhotoOwner = { accountId: 'fan', profileId: 'real' };
  await act(async () => renderHome());
  expect(host.textContent).toContain(
    `Selected activity mission: ${mockMissionId}`,
  );
});

test('late mission results from a previous session cannot replace the current profile list', async () => {
  let releaseOld: ((value: MissionsResponse) => void) | undefined;
  mockMissionsApi.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        releaseOld = resolve;
      }),
  );
  const currentMission: Mission = {
    ...mockMission,
    id: '00000000-0000-4000-8000-000000000012',
    title: 'Current account mission',
  };
  mockMissionsApi.list.mockImplementation(
    async (): Promise<MissionsResponse> => ({
      kind: 'available',
      missions: [currentMission],
      recommendedMissionId: null,
    }),
  );
  await act(async () =>
    mockController.signIn(async () => ({
      account: mockAccount,
      token: 'new-fixture-token',
      expiresAt: '2030-01-01',
    })),
  );
  expect(mockMissionsApi.list).toHaveBeenCalledTimes(2);
  await act(async () =>
    mockController.signIn(async () => ({
      account: mockAccount,
      token: 'current-fixture-token',
      expiresAt: '2030-01-01',
    })),
  );
  await act(async () =>
    releaseOld?.({
      kind: 'available',
      missions: [mockMission],
      recommendedMissionId: mockMissionId,
    }),
  );
  expect(mockMissionsApi.list).toHaveBeenCalledTimes(3);
  expect(host.textContent).toContain('Current account mission');
  expect(host.textContent).not.toContain('Clean up the paddock');
});

test('demo profile hides real missions and discards a late real response', async () => {
  expect(host.textContent).toContain('Clean up the paddock');
  mockMissionsApi.list.mockClear();
  let releaseOld: ((value: MissionsResponse) => void) | undefined;
  mockMissionsApi.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        releaseOld = resolve;
      }),
  );

  await act(async () =>
    mockController.signIn(async () => ({
      account: mockAccount,
      token: 'late-real-token',
      expiresAt: '2030-01-01',
    })),
  );
  expect(mockMissionsApi.list).toHaveBeenCalledTimes(1);

  await act(async () => mockController.select('demo'));
  expect(mockMissionsApi.list).toHaveBeenCalledTimes(1);
  expect(mockMissionsApi.enroll).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Missions unavailable for demo data.');
  expect(host.textContent).not.toContain('Clean up the paddock');
  expect(host.textContent).not.toContain('Enroll');
  expect(host.textContent).not.toContain('Use this mission');

  await act(async () =>
    releaseOld?.({
      kind: 'available',
      missions: [mockMission],
      recommendedMissionId: mockMissionId,
    }),
  );
  expect(mockMissionsApi.list).toHaveBeenCalledTimes(1);
  expect(mockMissionsApi.enroll).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Missions unavailable for demo data.');
  expect(host.textContent).not.toContain('Clean up the paddock');
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
