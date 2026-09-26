import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { randomUUID } from 'expo-crypto';
import { api } from '../account/native-auth';
import { createJourneyApi } from './api';
import { createRecorder } from './recorder';
import { captureStore } from './storage';
import { journeyTask, locationDriver, locationSamples } from './location';

let expired: (token: string) => void | Promise<void> = () => {};
export const journeyApi = createJourneyApi(api.request);
export const recorder = createRecorder({
  api: journeyApi,
  store: captureStore,
  location: locationDriver,
  uuid: randomUUID,
  now: Date.now,
  onExpired: (token) => expired(token),
});
export function bindJourneySession(handler: typeof expired) {
  expired = handler;
  return () => {
    expired = () => {};
  };
}
// Registered at module scope so Expo can deliver a locked-screen task on launch.
// Headless work writes encrypted samples only; it never loads session credentials.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  journeyTask,
  async ({ data, error }) => {
    if (error) {
      await recorder.interrupt('interrupted');
      return;
    }
    if (data?.locations)
      await recorder.collect(locationSamples(data.locations));
  },
);
