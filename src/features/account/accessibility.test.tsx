import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { AccessibilityInfo, Platform } from 'react-native';
import { AccountPanel } from './AccountPanel';
import { PointsTextProvider } from '../points/controls';

const mockEffects: (() => void | (() => void))[] = [];
const mockSetBold = jest.fn();
jest.mock('react', () => ({
  ...jest.requireActual<typeof import('react')>('react'),
  useEffect: (effect: () => void | (() => void)) => mockEffects.push(effect),
  useState: (initial: unknown) => [initial, mockSetBold],
}));
jest.mock('./provider', () => ({
  useAccount: () => ({ controller: {}, state: { kind: 'signedOut' } }),
}));
jest.mock('../points/provider', () => ({
  useHistory: () => ({ controller: {} }),
}));
jest.mock('./native-auth', () => ({ localSignInEnabled: false }));

const originalPlatform = Platform.OS;
const originalQuery = Object.getOwnPropertyDescriptor(
  AccessibilityInfo,
  'isBoldTextEnabled',
);
beforeEach(() => {
  mockEffects.length = 0;
  jest.clearAllMocks();
});
afterEach(() => {
  jest.restoreAllMocks();
  Platform.OS = originalPlatform;
  if (originalQuery) {
    Object.defineProperty(
      AccessibilityInfo,
      'isBoldTextEnabled',
      originalQuery,
    );
  }
});

for (const [name, mount] of [
  ['account', () => AccountPanel()],
  ['points', () => PointsTextProvider({ children: null })],
] as const) {
  test(`${name}: missing web bold-text capability leaves default and does not subscribe`, () => {
    Platform.OS = 'web';
    Object.defineProperty(AccessibilityInfo, 'isBoldTextEnabled', {
      configurable: true,
      value: undefined,
    });
    const subscribe = jest.spyOn(AccessibilityInfo, 'addEventListener');
    mount();
    expect(() => mockEffects[0]()).not.toThrow();
    expect(mockEffects[0]()).toBeUndefined();
    expect(subscribe).not.toHaveBeenCalled();
    expect(mockSetBold).not.toHaveBeenCalled();
  });
  for (const platform of ['ios', 'android', 'web'] as const) {
    test(`${name}: supported ${platform} preserves query, changes and listener cleanup`, async () => {
      Platform.OS = platform;
      const query = jest
        .spyOn(AccessibilityInfo, 'isBoldTextEnabled')
        .mockResolvedValue(true);
      const listener = AccessibilityInfo.addEventListener(
        'boldTextChanged',
        mockSetBold,
      );
      const remove = jest.spyOn(listener, 'remove');
      const subscribe = jest
        .spyOn(AccessibilityInfo, 'addEventListener')
        .mockReturnValue(listener);
      mount();
      const cleanup = mockEffects[0]();
      await Promise.resolve();
      expect(query).toHaveBeenCalledTimes(1);
      expect(subscribe).toHaveBeenCalledWith('boldTextChanged', mockSetBold);
      expect(mockSetBold).toHaveBeenCalledWith(true);
      const change: unknown = subscribe.mock.calls[0][1];
      if (typeof change === 'function') change(false);
      expect(mockSetBold).toHaveBeenLastCalledWith(false);
      expect(typeof cleanup).toBe('function');
      if (cleanup) cleanup();
      expect(remove).toHaveBeenCalledTimes(1);
    });
  }
}
