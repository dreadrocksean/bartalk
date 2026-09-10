// Over-the-air updates.
//
// Downloads in the background and applies on the next cold start rather than
// reloading under the user: an update that discards a half-typed message to save
// someone thirty seconds is a bad trade. The one exception is an update flagged
// critical, which asks first.

import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { Alert, AppState, type AppStateStatus } from "react-native";

const isCriticalUpdate = (manifest: unknown): boolean => {
  const extra = (manifest as { extra?: { expoClient?: { extra?: unknown } } })
    ?.extra;
  const payload = (extra as { expoClient?: { extra?: { critical?: boolean } } })
    ?.expoClient?.extra;
  return payload?.critical === true;
};

export const useOtaUpdates = () => {
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // Updates are disabled in development builds, where Metro serves the bundle.
    if (__DEV__ || !Updates.isEnabled) return;

    const check = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;

        const fetched = await Updates.fetchUpdateAsync();
        if (!fetched.isNew) return;

        if (isCriticalUpdate(fetched.manifest)) {
          Alert.alert(
            "Update ready",
            "An important update is ready. Restart now to apply it.",
            [
              { text: "Later", style: "cancel" },
              {
                text: "Restart",
                onPress: () => {
                  Updates.reloadAsync().catch(() => {});
                },
              },
            ],
          );
        }
        // Otherwise it applies silently on the next launch.
      } catch {
        // A failed update check must never block the app.
      } finally {
        isCheckingRef.current = false;
      }
    };

    check();
    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") check();
      },
    );
    return () => subscription.remove();
  }, []);
};
