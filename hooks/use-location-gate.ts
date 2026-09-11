// Whether this device is obliged to share its location, and currently cannot.
//
// A friend who is asked for location may say no; the link is theirs to end, and
// holding the whole app hostage over a permission they can revoke anyway would
// just be rude. A dependant cannot end the link — that is the entire point of
// guardianship — so the permission is not a preference for them. If they turn
// it off, the arrangement they are in silently stops working and their guardian
// is told nothing useful. The block is what stops that being a quiet way out.

import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import type { LocationPermissionState } from "../app/types/tracking";
import { getPermissionState } from "../tracking/permissions";
import { useTracking } from "../tracking/tracking-provider";

export const useLocationGate = () => {
  const { trackers, isLoading } = useTracking();
  const [permission, setPermission] = useState<LocationPermissionState | null>(
    null,
  );
  // iOS shows its permission dialog once. After that the only way through is
  // Settings, and a button offering to ask again would simply do nothing — so
  // this comes from the system rather than from whether we have asked yet.
  const [canAskAgain, setCanAskAgain] = useState(true);

  const refresh = useCallback(() => {
    getPermissionState()
      .then(setPermission)
      .catch(() => setPermission(null));
    Location.getForegroundPermissionsAsync()
      .then((result) => setCanAskAgain(result.canAskAgain))
      .catch(() => setCanAskAgain(true));
  }, []);

  useEffect(refresh, [refresh]);

  // Granting happens in Settings, outside the app, so the answer only changes
  // on the way back in.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") refresh();
      },
    );
    return () => subscription.remove();
  }, [refresh]);

  const hasGuardian = trackers.some((link) => link.kind === "dependant");

  return {
    /** Someone can see this person and they cannot switch that off. */
    hasGuardian,
    permission,
    canAskAgain,
    refresh,
    // Only once the links have actually loaded, or the gate flashes up for a
    // moment on every cold start before anyone knows whether it applies.
    isBlocked:
      !isLoading && hasGuardian && permission !== null && permission !== "always",
  };
};
