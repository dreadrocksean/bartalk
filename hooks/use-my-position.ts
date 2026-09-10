// The tracker's own position, needed to frame the map on both people. Distinct
// from the trackee's publisher: this is never written to Firestore, it only ever
// stays on this device.

import * as Location from "expo-location";
import { useEffect, useState } from "react";

import type { LatLng } from "../app/types/tracking";

export const useMyPosition = (enabled: boolean) => {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [isDenied, setIsDenied] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let subscription: Location.LocationSubscription | null = null;
    let isActive = true;

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!isActive) return;
      if (permission.status !== "granted") {
        setIsDenied(true);
        return;
      }
      setIsDenied(false);

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10_000,
          distanceInterval: 25,
        },
        (location) => {
          setPosition({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        },
      );
      if (!isActive) {
        subscription.remove();
        subscription = null;
      }
    })();

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, [enabled]);

  return { position, isDenied };
};
