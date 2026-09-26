import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Recording } from '../src/features/journeys/Recording';
import { createRecorder } from '../src/features/journeys/recorder';
import { journeySchema } from '../src/features/journeys/contracts';
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});
jest.mock('expo/virtual/env', () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: true,
    configurable: true,
  });
  return { env: {} };
});
jest.mock('react-native', () => ({
  StyleSheet: { create: (s: unknown) => s },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
const context = {
  token: 'synthetic',
  profileId: '00000000-0000-4000-8000-000000000001',
};
const journey = journeySchema.parse({
  id: '00000000-0000-4000-8000-000000000002',
  profileId: context.profileId,
  state: 'active',
  mode: 'walk',
  source: { kind: 'fixture', label: 'Synthetic' },
  startedAtMs: 1000,
  finishedAtMs: null,
  captureSessionId: '00000000-0000-4000-8000-000000000003',
  preciseExpiresAtMs: 999999,
  assessment: {
    version: 'test',
    revision: 0,
    calibration: 'unvalidated',
    status: 'unfinished',
    reasons: [],
    startRecorded: true,
    arrivalRecorded: false,
    sampleCount: 0,
  },
});
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
function setup() {
  const recorder = createRecorder({
    api: {
      start: async () => journey,
      read: async () => journey,
      evidence: async () => journey,
      finish: async () => ({ ...journey, state: 'finished' }),
      settle: async () => {
        throw new Error('offline');
      },
    },
    store: { read: async () => null, write: async () => {} },
    location: {
      permission: async () => true,
      isRunning: async () => true,
      start: async () => {},
      stop: async () => {},
    },
    uuid: () => 'request',
    now: () => 2000,
    onExpired: () => {},
  });
  const capture = {
    journey,
    captureSessionId: 'session',
    startRequestId: 'start',
    phase: 'active' as const,
    samples: [],
    sentCount: 12,
    batch: null,
    finish: null,
    settlement: null,
  };
  return {
    recorder,
    state: {
      capture,
      busy: true,
      collecting: true,
      award: null,
      message: null,
    },
  };
}
test('arrival and Stop stay enabled while sync is busy; recording exposes no planning inputs', async () => {
  const x = setup();
  const finish = jest.spyOn(x.recorder, 'finish').mockResolvedValue();
  await act(async () =>
    root.render(<Recording {...x} context={context} onPlan={() => {}} />),
  );
  expect(host.textContent).toContain('Recording journey');
  const buttons = [...host.querySelectorAll('button')];
  const stop = buttons.find((b) => b.textContent === 'Stop recording');
  expect(stop?.disabled).toBe(false);
  expect(buttons.find((b) => b.textContent === "I've arrived")?.disabled).toBe(
    false,
  );
  await act(async () => stop?.click());
  expect(finish).toHaveBeenCalledWith('stopped');
  expect(host.querySelectorAll('input')).toHaveLength(0);
});
test('finished receipt restores planning through its explicit action and never claims verified mode', async () => {
  const x = setup(),
    onPlan = jest.fn();
  const clear = jest.spyOn(x.recorder, 'clear').mockResolvedValue();
  await act(async () =>
    root.render(
      <Recording
        recorder={x.recorder}
        context={context}
        onPlan={onPlan}
        state={{
          ...x.state,
          busy: false,
          collecting: false,
          capture: { ...x.state.capture, phase: 'finished' },
        }}
      />,
    ),
  );
  expect(host.textContent).toContain(
    'GPS does not verify transport mode or carbon savings.',
  );
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent === 'Plan another journey')
      ?.click(),
  );
  expect(onPlan).toHaveBeenCalledTimes(1);
  expect(clear).toHaveBeenCalledTimes(1);
});
