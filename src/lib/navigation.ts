import type { LatLng } from "leaflet";

export type GPSCoordinates = {
  lat: number;
  lng: number;
};

export const gpsTrackingOptions: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 20000,
};

function getGeolocation(): Geolocation {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    throw new Error("Geolocation is not supported");
  }
  return navigator.geolocation;
}

export function getGPSLocation(
  options: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 12000,
  },
): Promise<GPSCoordinates> {
  return new Promise((resolve, reject) => {
    let geolocation: Geolocation;
    try {
      geolocation = getGeolocation();
    } catch (error) {
      reject(error);
      return;
    }

    geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      reject,
      options,
    );
  });
}

export function startGPSLocationTracking(
  onLocation: (location: GPSCoordinates) => void,
  onError: (error: GeolocationPositionError) => void,
  options: PositionOptions = gpsTrackingOptions,
): number {
  return getGeolocation().watchPosition(
    ({ coords }) => onLocation({ lat: coords.latitude, lng: coords.longitude }),
    onError,
    options,
  );
}

export function stopGPSLocationTracking(watchId: number | null): void {
  if (
    watchId !== null &&
    typeof navigator !== "undefined" &&
    "geolocation" in navigator
  ) {
    navigator.geolocation.clearWatch(watchId);
  }
}

export function createGPSLocationTracker({
  onLocation,
  onError,
  onTrackingChange,
}: {
  onLocation: (location: GPSCoordinates) => void;
  onError: (error: Error | GeolocationPositionError) => void;
  onTrackingChange: (isTracking: boolean) => void;
}) {
  let watchId: number | null = null;

  function stop() {
    stopGPSLocationTracking(watchId);
    watchId = null;
    onTrackingChange(false);
  }

  return {
    setTracking(shouldTrack: boolean) {
      if (!shouldTrack) {
        stop();
        return;
      }
      if (watchId !== null) return;

      try {
        watchId = startGPSLocationTracking(onLocation, (error) => {
          stop();
          onError(error);
        });
        onTrackingChange(true);
      } catch (error) {
        stop();
        onError(
          error instanceof Error
            ? error
            : new Error("GPS-Standort konnte nicht verfolgt werden"),
        );
      }
    },
    stop,
  };
}

export function closestDirectionIndex(
  location: LatLng,
  directions: { location: LatLng }[],
): { index: number; distance: number } | null {
  let closest: { index: number; distance: number } | null = null;
  directions.forEach((direction, index) => {
    const distance = location.distanceTo(direction.location);
    if (!closest || distance < closest.distance) {
      closest = { index, distance };
    }
  });
  return closest;
}

export function advanceDirectionIndex(
  closestDistance: number,
  closestIndex: number,
  currentIndex: number,
  wasNearDirection: boolean,
  directionCount: number,
): { index: number; wasNearDirection: boolean } | null {
  if (closestIndex >= 0 && closestDistance <= 20) {
    return { index: closestIndex, wasNearDirection: true };
  }
  if (wasNearDirection) {
    return {
      index: Math.min(currentIndex + 1, Math.max(0, directionCount - 1)),
      wasNearDirection: false,
    };
  }
  return null;
}
