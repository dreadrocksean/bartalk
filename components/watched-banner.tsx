// The trackee's side of the bargain: whenever someone is looking, they can see
// it, by name, for as long as it lasts.
//
// Mounted above the whole app rather than on one screen, because the point is
// that it cannot be missed by being on the wrong tab. It is not dismissible —
// only the watcher stopping clears it.

import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatDuration } from "../tracking/format";
import { useTracking } from "../tracking/tracking-provider";
import { unity } from "../app/utils/general";
import { Colors } from "../constants/theme";
import { IconSymbol } from "./ui/icon-symbol";

export const WatchedBanner = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { watchers } = useTracking();
  const [now, setNow] = useState(Date.now());
  const pulse = useRef(new Animated.Value(0)).current;
  const wasVisibleRef = useRef(false);

  const isVisible = watchers.length > 0;

  // A buzz on arrival, so the notice registers even if the screen isn't being
  // looked at when it appears.
  useEffect(() => {
    if (isVisible && !wasVisibleRef.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
    }
    wasVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isVisible, pulse]);

  if (!isVisible) return null;

  const names = watchers.map((session) => session.trackerName || "Someone");
  const subject =
    names.length === 1
      ? names[0]
      : `${names[0]} and ${names.length - 1} other${names.length > 2 ? "s" : ""}`;
  const earliestStart = Math.min(
    ...watchers.map((session) => session.startedAt || now),
  );

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top,
        backgroundColor: "#8C2F1E",
        zIndex: 100,
      }}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => router.push("/(tabs)")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: unity * 10,
          paddingHorizontal: unity * 16,
          paddingVertical: unity * 10,
        }}
        accessibilityRole="button"
        accessibilityLabel={`${subject} is viewing your location. Tap to manage who can see you.`}
      >
        <Animated.View style={{ opacity: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.45, 1],
        }) }}>
          <IconSymbol name="eye.fill" size={18} color="#fff" />
        </Animated.View>
        <Text
          style={{
            flex: 1,
            color: "#fff",
            fontSize: unity * 14,
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          {`${subject} is viewing your location`}
        </Text>
        <Text
          style={{
            color: Colors.light.bubbleMe,
            fontSize: unity * 13,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatDuration(now - earliestStart)}
        </Text>
      </Pressable>
    </View>
  );
};
