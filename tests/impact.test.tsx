import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import type { ResourceState } from '../src/features/account/resource';
import type { ImpactOverview } from '../src/features/impact/contracts';
import { ImpactScreen } from '../src/features/impact/ImpactScreen';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});

const mockRefresh = jest.fn(async () => {});
let mockState: ResourceState<ImpactOverview & { id: string }> = {
  kind: 'loading',
};
let mockProfile: { profileId: string } | null = { profileId: 'profile' };
jest.mock('../src/features/account/native-auth', () => ({
  api: { request: async () => [] },
}));
jest.mock('../src/features/account/useResource', () => ({
  useProfileContext: () => mockProfile,
  useResource: () => ({
    get state() {
      return mockState;
    },
    controller: { refresh: mockRefresh },
  }),
}));
jest.mock('lucide-react-native', () => ({
  ChevronDown: () => null,
  ChevronRight: () => null,
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pressable: ({
    children,
    onPress,
    accessibilityLabel,
    accessibilityState,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    accessibilityLabel?: string;
    accessibilityState?: { expanded?: boolean };
  }) => (
    <button
      aria-label={accessibilityLabel}
      aria-expanded={accessibilityState?.expanded}
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
    <button onClick={onPress} disabled={disabled}>
      {label}
    </button>
  ),
}));

const source = {
  id: 'fixture-factor',
  releaseVersion: 'synthetic-v1',
  sourceValue: 0.19,
  sourceUnit: 'kgCO2/vehicle-km' as const,
  publishedUnit: 'kgCO2e/vehicle-km' as const,
  occupants: 1,
  source: 'https://example.test/factors',
  period: 'Synthetic period',
  method: 'Synthetic method',
  assumptions: 'Synthetic assumptions',
};
const overview: ImpactOverview & { id: string } = {
  id: 'profile',
  official: { status: 'empty', metrics: [] },
  fan: {
    personal: {
      participation: {
        kind: 'available',
        activityCount: 2,
        missionsCompleted: 1,
        pointsEarned: 50,
      },
      travel: {
        kind: 'available',
        savingsKg: '5',
        journeyCount: 2,
        excludedJourneys: 0,
      },
    },
    community: {
      participation: {
        kind: 'available',
        activityCount: 4,
        missionsCompleted: 2,
      },
      travel: {
        kind: 'available',
        savingsKg: '9',
        journeyCount: 3,
        excludedJourneys: 1,
      },
    },
  },
  travelMethodology: {
    kind: 'available',
    period: 'lifetime',
    unit: 'kgCO2',
    sources: [source],
    validation: ['reviewed_release'],
  },
  methodology: [],
};
const metric = {
  id: '00000000-0000-4000-8000-000000000001',
  approvalId: '00000000-0000-4000-8000-000000000001',
  candidateId: '00000000-0000-4000-8000-000000000002',
  documentId: '00000000-0000-4000-8000-000000000003',
  title: 'AMR sustainability report',
  sourceKind: 'synthetic' as const,
  sha256: 'a'.repeat(64),
  parserVersion: 'fixture-v1',
  reviewerId: '00000000-0000-4000-8000-000000000004',
  approvedAt: '2026-01-01T00:00:00.000Z',
  fields: {
    name: { text: 'Trees planted', start: 0, end: 13 },
    value: { text: '100', start: 14, end: 17 },
    unit: { text: 'trees', start: 18, end: 23 },
    period: { text: '2025', start: 24, end: 28 },
    category: { text: 'Nature', start: 29, end: 35 },
    meaning: {
      text: 'Trees planted in the reporting period.',
      start: 36,
      end: 74,
    },
    method: { text: 'Reviewed source method', start: 75, end: 98 },
  },
  evidence: {
    page: 4,
    quote: '100 trees planted in 2025.',
    start: 0,
    end: 27,
  },
  missing: [],
  period: '2025',
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  mockState = { kind: 'loading' };
  mockProfile = { profileId: 'profile' };
  mockRefresh.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
function readyState(value: ImpactOverview & { id: string } = overview) {
  mockState = {
    kind: 'ready',
    items: [value],
    nextCursor: null,
    busy: false,
    error: null,
  };
}
function button(label: string) {
  const result = [...host.querySelectorAll('button')].find(
    (candidate) =>
      candidate.textContent === label ||
      candidate.getAttribute('aria-label') === label,
  );
  expect(result).toBeDefined();
  return result!;
}

test('overview keeps personal, community travel, participation, and official records separate', async () => {
  readyState({
    ...overview,
    official: { status: 'available', metrics: [metric] },
  });
  await act(async () => root.render(<ImpactScreen />));
  expect(host.textContent).toContain(
    '2 credited photo activities · 1 missions completed',
  );
  expect(host.textContent).toContain('Photo activity points earned: 50');
  expect(host.textContent).toContain(
    'Estimated travel savings: 5 kgCO2 · Lifetime',
  );
  expect(host.textContent).toContain(
    '4 credited photo activities · 2 missions completed',
  );
  expect(host.textContent).toContain(
    'Estimated travel savings: 9 kgCO2 · Lifetime',
  );
  expect(host.textContent).toContain('Aston Martin reported impact');
  expect(host.textContent).toContain('100 trees');
  expect(host.textContent).not.toContain('Impact unavailable');
  expect(
    button('Trees planted, 100 trees, 2025, source details').getAttribute(
      'aria-expanded',
    ),
  ).toBe('false');
  await act(async () =>
    button('Trees planted, 100 trees, 2025, source details').click(),
  );
  expect(host.textContent).toContain('Method: Reviewed source method');
  expect(host.textContent).toContain(
    'Source: AMR sustainability report, page 4; source kind: synthetic',
  );
  expect(host.textContent).toContain('https://example.test/factors');
  expect(host.textContent).toContain('Approval status: approved');
});

test('unavailable travel and official source remain unavailable, never zero', async () => {
  const value: ImpactOverview & { id: string } = {
    ...overview,
    official: {
      status: 'unavailable',
      metrics: [],
      reason: 'source_unavailable',
    },
    fan: {
      ...overview.fan,
      personal: {
        ...overview.fan.personal,
        travel: { kind: 'unavailable', reasons: ['source_unavailable'] },
      },
    },
    travelMethodology: { kind: 'unavailable', reason: 'source_unavailable' },
  };
  readyState(value);
  await act(async () => root.render(<ImpactScreen />));
  expect(host.textContent).toContain(
    'Reported figures unavailable (source_unavailable)',
  );
  expect(host.textContent).toContain(
    'Travel estimate unavailable. Retry to refresh the reviewed methodology.',
  );
  expect(host.textContent).toContain(
    'Travel methodology unavailable. Retry to refresh.',
  );
  expect(host.textContent).not.toContain('0 kgCO2');
});

test('error state explains missing impact and allows retry', async () => {
  mockState = { kind: 'error', error: 'Data unavailable. Retry.' };
  await act(async () => root.render(<ImpactScreen />));
  expect(host.textContent).toContain('Impact unavailable');
  expect(host.textContent).not.toContain('0 kg');
  expect(button('Refresh impact').disabled).toBe(false);
  mockRefresh.mockClear();
  await act(async () => button('Refresh impact').click());
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

test('loading and signed-out states do not display a prior profile overview', async () => {
  readyState();
  mockProfile = null;
  await act(async () => root.render(<ImpactScreen />));
  expect(host.textContent).toContain('Sign in to view impact.');
  expect(host.textContent).not.toContain('Estimated travel savings');
  expect(
    [...host.querySelectorAll('button')].some(
      (candidate) => candidate.textContent === 'Refresh impact',
    ),
  ).toBe(false);
});
