import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { Onboarding } from '../src/features/onboarding/Onboarding';

let mockState: { kind: string; account?: { id: string }; token?: string };
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
  useReducedMotion: () => true,
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
test('saving a name reaches full progress before entering app and persists only that account', async () => {
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
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(element.textContent).toContain('App content');
});

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
