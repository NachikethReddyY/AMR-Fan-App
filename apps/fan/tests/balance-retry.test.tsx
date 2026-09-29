import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, jest, test } from '@jest/globals';
import { Balance } from '../src/features/points/Balance';
const mockRefresh = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
jest.mock('../src/features/points/provider', () => ({
  useHistory: () => ({
    account: { kind: 'signedIn' },
    state: { kind: 'unavailable', message: 'Balance unavailable. Try again.' },
    controller: { refresh: mockRefresh },
  }),
}));
jest.mock('../src/features/points/controls', () => ({
  Text: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  Action: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  useWindowDimensions: () => ({ fontScale: 1 }),
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pressable: ({
    children,
    onPress,
    accessibilityLabel,
    style,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    accessibilityLabel: string;
    style: ({ pressed }: { pressed: boolean }) => unknown[];
  }) => (
    <button
      aria-label={accessibilityLabel}
      onClick={onPress}
      data-styles={JSON.stringify(style({ pressed: false }))}
    >
      {children}
    </button>
  ),
}));
jest.mock('lucide-react-native', () => ({
  RotateCw: () => <svg data-icon="refresh" />,
}));
test('balance retry is compact, named, at least 44pt and invokes the existing refresh once', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  try {
    await act(async () => root.render(<Balance prominent />));
    const retry = element.querySelector<HTMLButtonElement>(
      'button[aria-label="Retry balance and History"]',
    );
    expect(retry).not.toBeNull();
    expect(element.textContent).toContain('Balance unavailable');
    expect(retry?.querySelector('[data-icon="refresh"]')).not.toBeNull();
    expect(retry?.textContent).toBe('');
    const styles: unknown = JSON.parse(retry?.dataset.styles ?? 'null');
    expect(styles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 48, height: 48 }),
      ]),
    );
    await act(async () => retry?.click());
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    element.remove();
  }
});
