// Trackee side: decides whether this device should be publishing its position,
// to whom, and how often.
//
// The rule that keeps this honest is simple — no active link means no publishing
// at all: no background service, no battery cost, nothing written. Everything
// else follows from the audience.

import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { publishLocation, setLocationAudience } from "../tracking-api";
import {
  publishFixBestEffort,
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from "../tracking/background-location-task";
import {
  LIVE_LOCATION_DISTANCE_M,
  LIVE_LOCATION_INTERVAL_MS,
} from "../tracking/constants";
import { getPermissionState } from "../tracking/permissions";
import {
  clearPublishConfig,
  savePublishConfig,
  takePendingFix,
} from "../tracking/publish-config";
import { useTracking } from "../tracking/tracking-provider";

export const useLocationPublisher = () => {
  const { userId, trackers, watchers } = useTracking();

  // Only unpaused links may see this device. Memoised because this array is an
  // effect dependency — rebuilding it every render would restart the background
  // location service on every render.
  const audience = useMemo(
    () =>
      trackers
        .filter((link) => !link.pausedByTrackee)
        .map((link) => link.trackerId)
        .sort(),
    [trackers],
  );
  const audienceKey = audience.join(",");
  const isLive = watchers.length > 0;

  const foregroundWatchRef = useRef<Location.LocationSubscription | null>(null);
  const lastAudienceKeyRef = useRef<string | null>(null);

  const stopForegroundWatch = useCallback(() => {
    foregroundWatchRef.current?.remove();
    foregroundWatchRef.current = null;
  }, []);

  // Publish, and keep the stored config in step so the background task — which
  // runs with no access to React state — writes the same audience we would.
  useEffect(() => {
    if (!userId) return;
    let isActive = true;

    (async () => {
      if (audience.length === 0) {
        await stopBackgroundLocationUpdates();
        stopForegroundWatch();
        await clearPublishConfig();
        // Close off read access straight away rather than at the next fix.
        if (lastAudienceKeyRef.current !== null) {
          lastAudienceKeyRef.current = null;
          await setLocationAudience({ userId, sharedWith: [] }).catch(() => {});
        }
        return;
      }

      const permissionState = await getPermissionState();
      if (!isActive) return;

      await savePublishConfig({
        userId,
        sharedWith: audience,
        permissionState,
        mode: isLive ? "live" : "idle",
      });

      if (lastAudienceKeyRef.current !== audienceKey) {
        lastAudienceKeyRef.current = audienceKey;
        await setLocationAudience({
          userId,
          sharedWith: audience,
          permissionState,
        }).catch(() => {});
      }

      if (permissionState === "denied") {
        await stopBackgroundLocationUpdates();
        stopForegroundWatch();
        return;
      }

      if (permissionState === "always") {
        // Restarting with new options is how the task switches cadence.
        await stopBackgroundLocationUpdates();
        if (!isActive) return;
        await startBackgroundLocationUpdates(isLive).catch(() => {});
      }

      // While someone is actively watching, publish from the foreground too, so
      // the pin moves at conversation speed rather than at battery-saver speed.
      if (isLive) {
        if (!foregroundWatchRef.current) {
          foregroundWatchRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: LIVE_LOCATION_INTERVAL_MS,
              distanceInterval: LIVE_LOCATION_DISTANCE_M,
            },
            (location) => {
              publishLocation({
                userId,
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                accuracy: location.coords.accuracy ?? null,
                heading: location.coords.heading ?? null,
                speed: location.coords.speed ?? null,
                capturedAt: location.timestamp,
                mode: "live",
                sharedWith: audience,
                permissionState,
              }).catch(() => {});
            },
          );
        }
      } else {
        stopForegroundWatch();
      }
    })();

    return () => {
      isActive = false;
    };
  }, [audience, audienceKey, isLive, stopForegroundWatch, userId]);

  useEffect(() => stopForegroundWatch, [stopForegroundWatch]);

  // A fix the background task couldn't write gets flushed once we're back in the
  // foreground with a real network window.
  useEffect(() => {
    if (!userId) return;

    const flush = async () => {
      const pending = await takePendingFix();
      if (!pending || audience.length === 0) return;
      const permissionState = await getPermissionState();
      await publishLocation({
        userId,
        ...pending,
        mode: "idle",
        sharedWith: audience,
        permissionState,
      }).catch(() => {});
    };

    flush();
    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") flush();
      },
    );
    return () => subscription.remove();
  }, [audience, userId]);

  /** Used by the request-acceptance flow to take a first fix immediately. */
  const publishCurrentPosition = useCallback(async () => {
    if (!userId) return;
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await publishFixBestEffort(location);
  }, [userId]);

  return { publishCurrentPosition };
};
