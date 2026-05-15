import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  onAuthStateChanged,
  type FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { updateUserExpoPushToken } from "../api";
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
