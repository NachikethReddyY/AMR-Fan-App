import { captureStore } from './storage';
import type { StoredCapture } from './recorder';

const mockRead = jest.fn();
const mockRun = jest.fn();
const mockDecrypt = jest.fn();
const mockFromCombined = jest.fn((input: unknown) => {
  if (!(input instanceof Uint8Array))
    throw new Error('Android fromCombined requires bytes');
  return { bytes: input };
});
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    execAsync: jest.fn(),
    getFirstAsync: mockRead,
    runAsync: mockRun,
  }),
}));
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: async () => 'synthetic-key',
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  AESEncryptionKey: { import: async () => ({}) },
  AESSealedData: { fromCombined: (input: unknown) => mockFromCombined(input) },
  aesDecryptAsync: (...args: unknown[]) => mockDecrypt(...args),
}));

test('passes stored base64 ciphertext as bytes to the native bridge and validates recovered capture', async () => {
  const capture: StoredCapture = {
    journey: {
      id: '00000000-0000-4000-8000-000000000001',
      profileId: '00000000-0000-4000-8000-000000000002',
      state: 'prepared',
      mode: 'walk',
      source: { kind: 'fixture', label: 'Synthetic' },
      startedAtMs: null,
      finishedAtMs: null,
      captureSessionId: null,
      preciseExpiresAtMs: 999999,
      assessment: {
        version: 'v1',
        revision: 0,
        calibration: 'unvalidated',
        status: 'unfinished',
        reasons: [],
        startRecorded: false,
        arrivalRecorded: false,
        sampleCount: 0,
      },
    },
    captureSessionId: '00000000-0000-4000-8000-000000000003',
    startRequestId: '00000000-0000-4000-8000-000000000004',
    phase: 'starting',
    samples: [],
    sentCount: 0,
    batch: null,
    finish: null,
    settlement: null,
  };
  mockRead.mockResolvedValue({ ciphertext: 'AAH+/w==' });
  mockDecrypt.mockResolvedValue(
    new TextEncoder().encode(JSON.stringify(capture)),
  );
  await expect(captureStore.read()).resolves.toEqual(capture);
  expect(mockFromCombined).toHaveBeenCalledWith(
    new Uint8Array([0, 1, 254, 255]),
  );
});
