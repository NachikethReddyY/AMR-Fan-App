import * as Location from 'expo-location';
import { AppState, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { sampleSchema, type Sample } from './contracts';
import type { LocationDriver } from './recorder';

export const journeyTask = 'amr.journey.locations.v1';
export function locationSamples(
  locations: Location.LocationObject[],
  receivedAtMs = Date.now(),
): Sample[] {
  return locations.flatMap((location) => {
    const parsed = sampleSchema.safeParse({
      id: randomUUID(),
      acquiredAtMs: Math.trunc(location.timestamp),
      receivedAtMs,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracyMeters: location.coords.accuracy,
      context:
        AppState.currentState === 'active'
          ? 'foreground'
          : AppState.currentState === 'background'
            ? 'background'
            : 'unknown',
      mocked: location.mocked ?? null,
    });
    return parsed.success ? [parsed.data] : [];
  });
}
export const locationDriver: LocationDriver = {
  async isRunning() {
    return (
      Platform.OS !== 'web' &&
      (await Location.hasStartedLocationUpdatesAsync(journeyTask))
    );
  },
  async permission() {
    if (Platform.OS === 'web' || !(await Location.hasServicesEnabledAsync()))
      return false;
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) return false;
    const background = await Location.requestBackgroundPermissionsAsync();
    return background.granted;
  },
  async start() {
    if (await Location.hasStartedLocationUpdatesAsync(journeyTask)) return;
    await Location.startLocationUpdatesAsync(journeyTask, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 5,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Journey recording',
        notificationBody:
          'AMR Fan is recording your route. Open Travel to finish.',
        killServiceOnDestroy: true,
      },
    });
  },
  async stop() {
    if (
      Platform.OS !== 'web' &&
      (await Location.hasStartedLocationUpdatesAsync(journeyTask))
    )
      await Location.stopLocationUpdatesAsync(journeyTask);
  },
};
