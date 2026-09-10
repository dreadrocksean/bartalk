// Handles the silent push the server sends when someone starts watching, so the
// first position the tracker sees is a fresh one rather than whatever the last
// background window happened to capture.
//
// This is an optimisation, never a guarantee: the OS may drop background
// notifications in doze, and Apple advises no more than a few per hour. The
// visible notification to the trackee is the contract; this only improves the
// picture the tracker gets.

import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import { publishFixBestEffort } from "./background-location-task";
import { loadPublishConfig } from "./publish-config";

const WAKE_NOTIFICATION_TASK = "bartalk-location-wake";

/** The payload shape differs by platform, so every known path is checked. */
const readNotificationType = (data: unknown): string => {
  const candidates = [
    (data as { type?: unknown })?.type,
    (data as { data?: { type?: unknown } })?.data?.type,
    (data as { notification?: { data?: { type?: unknown } } })?.notification
      ?.data?.type,
    (
      data as {
        notification?: { request?: { content?: { data?: { type?: unknown } } } };
      }
    )?.notification?.request?.content?.data?.type,
  ];
  const match = candidates.find((value) => typeof value === "string");
  return typeof match === "string" ? match : "";
};

TaskManager.defineTask(WAKE_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) return;
  if (readNotificationType(data) !== "location-wake") return;

  const config = await loadPublishConfig();
  if (!config || config.sharedWith.length === 0) return;

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await publishFixBestEffort(location);
  } catch {
    // No fix available in this window; the next background update covers it.
  }
});

Notifications.registerTaskAsync(WAKE_NOTIFICATION_TASK).catch(() => {
  // Background notification handling is unavailable (simulator, or the OS
  // declined). The feature degrades to the normal background cadence.
});
