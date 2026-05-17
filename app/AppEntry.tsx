import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  onAuthStateChanged,
  type FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { getUserExpoPushToken, updateUserExpoPushToken } from "../api";
import { getFirebaseAuth } from "../firebase";
import AuthScreen from "./auth";
import ContactsScreen from "./screens/ContactsScreen/ContactsScreen";

const AppEntry = () => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);
  const { requestPushPermissionAndToken } = usePushNotifications();

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    let isActive = true;

    (async () => {
      let existingToken: string | null = null;
      try {
        existingToken = await getUserExpoPushToken(user.uid);
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
          "Enable notifications so you don't miss new messages.",
          [
            {
              text: "Not now",
              style: "cancel",
              onPress: () => resolveOnce(false),
            },
            {
              text: "Allow",
              onPress: () => resolveOnce(true),
            },
          ],
          {
            cancelable: true,
            onDismiss: () => resolveOnce(false),
          },
        );
      });

      if (!isActive || !shouldAskForPermission) return;
      const expoPushToken = await requestPushPermissionAndToken();
      if (!isActive || !expoPushToken) return;
      try {
        await updateUserExpoPushToken(user.uid, expoPushToken);
      } catch {
        // ignore token update errors
      }
    })();

    return () => {
      isActive = false;
    };
  }, [requestPushPermissionAndToken, user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }
  if (!user) {
    return (
      <AuthScreen
        onAuthSuccess={() => setUser(getFirebaseAuth().currentUser)}
      />
    );
  }
  return <ContactsScreen user={user} />;
};

export default AppEntry;
