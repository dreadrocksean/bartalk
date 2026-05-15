import * as Notifications from "expo-notifications";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

const MESSAGES_NOTIFICATION_CHANNEL_ID = "messages";

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);

  const requestPushPermissionAndToken = useCallback(async () => {
    let finalStatus;
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      setPermissionStatus(finalStatus);
      if (finalStatus === "granted") {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync(
            MESSAGES_NOTIFICATION_CHANNEL_ID,
            {
              name: "Messages",
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: "#007AFF",
              sound: "default",
            },
          );
        }
        const tokenData = await Notifications.getExpoPushTokenAsync();
        setExpoPushToken(tokenData.data);
        return tokenData.data;
      } else {
        setExpoPushToken(null);
        return null;
      }
    } catch {
      setPermissionStatus(null);
      setExpoPushToken(null);
      return null;
    }
  }, []);

  return { expoPushToken, permissionStatus, requestPushPermissionAndToken };
}
