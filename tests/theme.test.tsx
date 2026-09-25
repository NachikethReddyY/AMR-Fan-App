import React, { act } from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createRoot, type Root } from 'react-dom/client';
import { GluestackUIProvider } from '../components/ui/gluestack-ui-provider/index.web';

jest.mock('@gluestack-ui/core/overlay/creator', () => ({
  OverlayProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@gluestack-ui/core/toast/creator', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

let root: Root;
let container: HTMLDivElement;
let dark = true;
const listeners = new Set<(event: { matches: boolean }) => void>();

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  dark = true;
  document.documentElement.className = '';
  listeners.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: dark,
      addListener: (callback: (event: { matches: boolean }) => void) =>
        listeners.add(callback),
      removeListener: (callback: (event: { matches: boolean }) => void) =>
        listeners.delete(callback),
    }),
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(mode: 'light' | 'dark' | 'system') {
  act(() =>
    root.render(<GluestackUIProvider mode={mode}>Fixture</GluestackUIProvider>),
  );
}

test('initial system mode and explicit changes apply without inline script execution', () => {
  render('system');
  expect(document.documentElement.className).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(container.querySelector('script')).toBeNull();
  render('light');
  expect(document.documentElement.className).toBe('light');
  expect(document.documentElement.style.colorScheme).toBe('light');
  render('dark');
  expect(document.documentElement.className).toBe('dark');
});

test('entering system mode reads current preference and subscribes only while active', () => {
  render('light');
  render('system');
  expect(document.documentElement.className).toBe('dark');
  expect(listeners.size).toBe(1);
  act(() => {
    dark = false;
    listeners.forEach((listener) => listener({ matches: false }));
  });
  expect(document.documentElement.className).toBe('light');
  render('dark');
  expect(listeners.size).toBe(0);
});
