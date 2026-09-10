// Background location publishing for the trackee's device.
//
// TaskManager.defineTask MUST run in the global scope of the bundle: when the OS
// launches the app in the background there are no mounted views, so registration
// cannot live in a component. This module is imported for its side effect from
// app/_layout.tsx.

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { publishLocation } from "../tracking-api";
import {
  BACKGROUND_LOCATION_TASK,
  IDLE_LOCATION_DISTANCE_M,
  IDLE_LOCATION_INTERVAL_MS,
  LIVE_LOCATION_DISTANCE_M,
  LIVE_LOCATION_INTERVAL_MS,
} from "./constants";
import {
  loadPublishConfig,
  savePendingFix,
  type PendingFix,
} from "./publish-config";

/**
 * A background window is only a few seconds on iOS, and Firestore writes have
 * been observed to hang in headless JS while the auth token refreshes. Racing
 * the write means a stalled call costs us one buffered fix rather than the whole
 * task budget.
 */
const BACKGROUND_WRITE_TIMEOUT_MS = 8_000;

const withTimeout = async (work: Promise<unknown>, ms: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("write-timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const toPendingFix = (location: Location.LocationObject): PendingFix => ({
  lat: location.coords.latitude,
  lng: location.coords.longitude,
  accuracy: location.coords.accuracy ?? null,
  heading: location.coords.heading ?? null,
  speed: location.coords.speed ?? null,
  capturedAt: location.timestamp,
});

/**
 * Writes a fix, and buffers it for the next foreground if the write doesn't
 * land. Map correctness never depends on a background write succeeding.
 */
export const publishFixBestEffort = async (
  location: Location.LocationObject,
) => {
  const config = await loadPublishConfig();
  if (!config || config.sharedWith.length === 0) {
    // Nobody is allowed to see this device, so there is nothing to publish.
    return;
  }

  const fix = toPendingFix(location);
  try {
    await withTimeout(
      publishLocation({
        userId: config.userId,
        ...fix,
        mode: config.mode,
        sharedWith: config.sharedWith,
        permissionState: config.permissionState,
      }),
      BACKGROUND_WRITE_TIMEOUT_MS,
    );
  } catch {
    await savePendingFix(fix);
  }
};

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) return;
    const locations = data?.locations ?? [];
    const latest = locations[locations.length - 1];
    if (!latest) return;
    await publishFixBestEffort(latest);
  },
);

export const isBackgroundLocationRunning = () =>
  Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);

/**
 * Android needs a foreground service notification to deliver background
 * locations at all, and iOS shows the blue status bar because
 * showsBackgroundLocationIndicator is on. Both are deliberate: a tracking app
 * that hides the fact it is tracking is the thing this feature exists against.
 */
export const startBackgroundLocationUpdates = async (live: boolean) => {
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: live ? Location.Accuracy.High : Location.Accuracy.Balanced,
    distanceInterval: live ? LIVE_LOCATION_DISTANCE_M : IDLE_LOCATION_DISTANCE_M,
    timeInterval: live ? LIVE_LOCATION_INTERVAL_MS : IDLE_LOCATION_INTERVAL_MS,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Other,
    foregroundService: {
      notificationTitle: "BarTalk is sharing your location",
      notificationBody: live
        ? "Someone is viewing your location right now."
        : "Your family can see where you are.",
      notificationColor: "#a47831",
      killServiceOnDestroy: false,
    },
  });
};

export const stopBackgroundLocationUpdates = async () => {
  if (await isBackgroundLocationRunning()) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
};
