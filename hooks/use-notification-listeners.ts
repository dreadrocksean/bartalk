import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

export function useNotificationListeners() {
  const router = useRouter();
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Foreground notification handler
    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {
        // Foreground notifications are shown by the handler above.
      });

    // Notification response handler (when tapped)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as {
          senderId?: string;
        };
        if (data?.senderId) {
          router.push({
            pathname: "/screens/MessagingScreen",
            params: { contactId: data.senderId },
          });
        }
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);
}
