/**
 * Position updates for the duration of a measurement.
 *
 * The position is watched while the sound is recorded and the most accurate
 * fix is kept. Asking once is not enough: the first answer of a phone is
 * often coarse, and browsers may answer a single request from a cached fix
 * that was taken somewhere else. Here a fix must be fresh (`maximumAge: 0`).
 *
 * In the browser the Geolocation API is used directly, so this also works in
 * browsers without the Permissions API (older iOS).
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface PositionFix {
  latitude: number;
  longitude: number;
  /** Radius of uncertainty in metres. */
  accuracy: number;
  altitude?: number;
  /** When the device determined this position (ms since epoch). */
  timestamp: number;
}

export type PositionErrorReason = 'denied' | 'timeout' | 'unavailable';

export interface PositionWatch {
  stop: () => void;
}

/** How long the browser may take for a single fix. */
const FIX_TIMEOUT_MS = 20000;

export function watchPosition(
  onFix: (fix: PositionFix) => void,
  onError: (reason: PositionErrorReason) => void
): PositionWatch {
  let stopped = false;

  if (Platform.OS === 'web') {
    const geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geolocation) {
      onError('unavailable');
      return { stop: () => undefined };
    }

    const watchId = geolocation.watchPosition(
      (position) => {
        if (stopped) {
          return;
        }
        onFix({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 0,
          altitude: position.coords.altitude ?? undefined,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        if (stopped) {
          return;
        }
        onError(error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: FIX_TIMEOUT_MS }
    );

    return {
      stop: () => {
        stopped = true;
        geolocation.clearWatch(watchId);
      },
    };
  }

  let subscription: Location.LocationSubscription | null = null;

  void (async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (stopped) {
        return;
      }
      if (status !== 'granted') {
        onError('denied');
        return;
      }

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 },
        (location) => {
          if (stopped) {
            return;
          }
          onFix({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? 0,
            altitude: location.coords.altitude ?? undefined,
            timestamp: location.timestamp,
          });
        }
      );

      if (stopped) {
        subscription.remove();
      }
    } catch {
      if (!stopped) {
        onError('unavailable');
      }
    }
  })();

  return {
    stop: () => {
      stopped = true;
      subscription?.remove();
    },
  };
}
