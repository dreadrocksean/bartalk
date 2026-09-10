// Asks for notification permission once and stores the Expo push token.
//
// Lifted out of the old AppEntry screen unchanged in behaviour: the app asks in
// its own words first, so a "Not now" costs a soft prompt rather than burning
// the one system prompt the OS allows.

import { useEffect } from "react";
import { Alert } from "react-native";

import { getUserExpoPushToken, updateUserExpoPushToken } from "../api";
import { usePushNotifications } from "./use-push-notifications";

export const usePushTokenRegistration = (userId: string | null) => {
  const { requestPushPermissionAndToken } = usePushNotifications();

  useEffect(() => {
    if (!userId) return;
    let isActive = true;

    (async () => {
      let existingToken: string | null = null;
      try {
        existingToken = await getUserExpoPushToken(userId);
      } catch {
        existingToken = null;
      }

      if (!isActive) return;
      if (existingToken && existingToken.trim().length > 0) return;

      const shouldAskForPermission = await new Promise<boolean>((resolve) => {
        let resolved = false;
        const resolveOnce = (value: boolean) => {
          if (resolved) return;
          resolved = true;
          resolve(value);
        };
        Alert.alert(
          "Stay in the loop",
          "Enable notifications so you don't miss new messages — and so you're told whenever someone checks your location.",
          [
            {
              text: "Not now",
              style: "cancel",
              onPress: () => resolveOnce(false),
            },
            { text: "Allow", onPress: () => resolveOnce(true) },
          ],
          { cancelable: true, onDismiss: () => resolveOnce(false) },
        );
      });

      if (!isActive || !shouldAskForPermission) return;
      const expoPushToken = await requestPushPermissionAndToken();
      if (!isActive || !expoPushToken) return;
      try {
        await updateUserExpoPushToken(userId, expoPushToken);
      } catch {
        // A missing token only costs push delivery, not correctness.
      }
    })();

    return () => {
      isActive = false;
    };
  }, [requestPushPermissionAndToken, userId]);
};
