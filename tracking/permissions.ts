// Location permission handling for the trackee side.
//
// The order matters: iOS and Android both require foreground permission before
// background can even be asked for. On Android 11+ the background request opens
// the system Settings page rather than a dialog and resolves before the user has
// chosen, so the result is re-checked when the app next comes to the foreground.

import * as Location from "expo-location";

import type { LocationPermissionState } from "../app/types/tracking";

export const getPermissionState =
  async (): Promise<LocationPermissionState> => {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== "granted") return "denied";

    const background = await Location.getBackgroundPermissionsAsync();
    return background.status === "granted" ? "always" : "whenInUse";
  };

/**
 * Foreground-only is a usable state, not a failure: the trackee still appears on
 * the map while their app is open. The tracker's UI says so explicitly rather
 * than showing a pin that quietly stops moving.
 */
export const requestTrackingPermissions =
  async (): Promise<LocationPermissionState> => {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== "granted") return "denied";

    const background = await Location.requestBackgroundPermissionsAsync();
    return background.status === "granted" ? "always" : "whenInUse";
  };
