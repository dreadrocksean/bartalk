import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { useTracking } from "@/tracking/tracking-provider";

const TabLayout = () => {
  const colorScheme = useColorScheme();
  const { userId, incomingRequests, watchers } = useTracking();
  const { total: unreadTotal } = useUnreadCounts(userId);

  // A request waiting on me, or someone looking at me right now, is worth a dot
  // on the tab: the trackee shouldn't have to go looking for either.
  const trackBadgeCount = incomingRequests.length + watchers.length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      {/* Track is `index` — the screen the app opens on. */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Track",
          tabBarBadge: trackBadgeCount > 0 ? trackBadgeCount : undefined,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="location.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined,
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="bubble.left.and.bubble.right.fill"
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
};

export default TabLayout;
