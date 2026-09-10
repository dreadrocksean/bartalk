import "react-native-gesture-handler";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

// Side-effect import: TaskManager tasks must be registered in the global scope
// so the OS can run them when the app is launched into the background with no
// views mounted.
import "@/tracking/background-location-task";
import "@/tracking/wake-notification-task";

import { WatchedBanner } from "@/components/watched-banner";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useNotificationListeners } from "@/hooks/use-notification-listeners";
import { useOtaUpdates } from "@/hooks/use-ota-updates";
import { usePushTokenRegistration } from "@/hooks/use-push-token-registration";
import { TrackingProvider } from "@/tracking/tracking-provider";
import { TrackingRuntime } from "@/tracking/tracking-runtime";
import AuthScreen from "./auth";

export const unstable_settings = {
  anchor: "(tabs)",
};

const RootLayout = () => {
  const colorScheme = useColorScheme();
  const { user, isLoading } = useAuthSession();
  const userId = user?.uid ?? null;
  const myName = useMyProfile(userId, user?.displayName ?? undefined);

  useNotificationListeners();
  usePushTokenRegistration(userId);
  useOtaUpdates();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <TrackingProvider userId={userId} myName={myName}>
          <TrackingRuntime />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>

          {/* Signed in: the watch banner sits above every screen, so it can't be
              missed by being on the wrong tab. */}
          {user ? <WatchedBanner /> : null}

          {/* Signed out: the auth screen covers the app rather than replacing
              the navigator, so a navigator is always mounted. */}
          {!user && !isLoading ? (
            <View style={StyleSheet.absoluteFill}>
              <AuthScreen />
            </View>
          ) : null}

          {isLoading ? (
            <View style={[StyleSheet.absoluteFill, styles.loading]}>
              <ActivityIndicator size="large" color="#a47831" />
            </View>
          ) : null}
        </TrackingProvider>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e5ea",
  },
});

export default RootLayout;
