import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import './runtime';

const mockInterrupt = jest.fn();
const mockCollect = jest.fn();
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-location', () => ({}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('../account/native-auth', () => ({ api: { request: jest.fn() } }));
jest.mock('./storage', () => ({ captureStore: {} }));
jest.mock('./location', () => ({
  journeyTask: 'amr.journey.locations.v1',
  locationDriver: {},
  locationSamples: (locations: unknown) => locations,
}));
jest.mock('./recorder', () => ({
  createRecorder: () => ({
    interrupt: (...args: unknown[]) => mockInterrupt(...args),
    collect: (...args: unknown[]) => mockCollect(...args),
  }),
}));
const task = jest.mocked(TaskManager.defineTask).mock.calls[0]?.[1];
if (!task) throw new Error('Location task was not registered');
const runTask = task;
const executionInfo = {
  eventId: 'synthetic',
  taskName: 'amr.journey.locations.v1',
};

test('iOS temporary unknown location keeps capture alive for the next native callback', async () => {
  Platform.OS = 'ios';
  await runTask({
    data: null,
    error: {
      code: 0,
      message: 'Error Domain=kCLErrorDomain Code=0 "Location unknown"',
    },
    executionInfo,
  });
  expect(mockInterrupt).not.toHaveBeenCalled();
  await runTask({ data: { locations: [] }, error: null, executionInfo });
  expect(mockCollect).toHaveBeenCalledWith([]);
});

test.each([
  ['ios', 1],
  ['ios', 2],
  ['android', 0],
] as const)('%s error %s remains an interruption', async (platform, code) => {
  mockInterrupt.mockClear();
  Platform.OS = platform;
  await runTask({
    data: null,
    error: { code, message: 'Other failure' },
    executionInfo,
  });
  expect(mockInterrupt).toHaveBeenCalledWith('interrupted');
});

test('generic iOS zero without CoreLocation domain remains an interruption', async () => {
  mockInterrupt.mockClear();
  Platform.OS = 'ios';
  await runTask({
    data: null,
    error: { code: 0, message: 'Error Domain=OtherDomain Code=0' },
    executionInfo,
  });
  expect(mockInterrupt).toHaveBeenCalledWith('interrupted');
});
