import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { ImpactScreen } from '../src/features/impact/ImpactScreen';
import type { ContributionState } from '../src/features/impact/presentation';
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});
const mockRefresh = jest.fn(async () => {});
let mockImpact: ContributionState = { kind: 'loading' };
jest.mock('../src/features/impact/useContributions', () => ({
  useContributions: () => ({
    state: mockImpact,
    controller: { refresh: mockRefresh },
  }),
}));
jest.mock('../src/features/account/native-auth', () => ({
  api: { request: async () => [] },
}));
jest.mock('../src/features/account/useResource', () => ({
  useResource: () => ({
    state: {
      kind: 'ready',
      items: [],
      nextCursor: null,
      busy: false,
      error: null,
    },
    controller: { refresh: async () => {} },
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
  }: {
    children: React.ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
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
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  mockRefresh.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test('populated estimates keep lifetime units, source disclosure and official figures separate', async () => {
  mockImpact = {
    kind: 'ready',
    nextCursor: null,
    busy: false,
    error: null,
    items: [
      {
        id: 'profile',
        period: 'lifetime',
        unit: 'kgCO2',
        validation: [],
        personal: {
          kind: 'available',
          savingsKg: '5',
          journeyCount: 2,
          excludedJourneys: 0,
        },
        community: {
          kind: 'available',
          savingsKg: '9',
          journeyCount: 3,
          excludedJourneys: 1,
        },
        sources: [
          {
            id: 'fixture-factor',
            releaseVersion: 'synthetic-v1',
            sourceValue: 0.1901,
            sourceUnit: 'kgCO2/vehicle-km',
            publishedUnit: 'kgCO2e/vehicle-km',
            occupants: 1,
            source: 'https://example.test/factors',
            period: 'Synthetic period',
            method: 'Synthetic method',
            assumptions: 'Synthetic assumptions',
          },
        ],
      },
    ],
  };
  await act(async () => root.render(<ImpactScreen />));
  expect(host.textContent).toContain('Estimated CO2 avoided: 5 kg · Lifetime');
  expect(host.textContent).toContain('Estimated CO2 avoided: 9 kg · Lifetime');
  expect(host.textContent).toContain('https://example.test/factors');
  expect(host.textContent).toContain('Synthetic method');
  expect(host.textContent).toContain('1 journeys await');
  expect(host.textContent).toContain('Official team figures');
  expect(host.textContent).toContain(
    'No approved figures have been published.',
  );
  expect(host.textContent).not.toContain('Impact unavailable');
});
test('failure retains honest unavailable copy and permits retry without hiding official figures', async () => {
  mockImpact = { kind: 'error', error: 'Data unavailable. Retry.' };
  await act(async () => root.render(<ImpactScreen />));
  expect(host.textContent).toContain('Impact unavailable');
  expect(host.textContent).not.toContain('0 kg');
  const refresh = [...host.querySelectorAll('button')].find(
    (button) => button.textContent === 'Refresh impact',
  );
  expect(refresh).toBeDefined();
  await act(async () => refresh?.click());
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('Official team figures');
});
