import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import { Colors } from "../../../../constants/theme";
import { useTrackeeLocations } from "../../../../hooks/use-trackee-locations";
import { formatAge } from "../../../../tracking/format";
import { useTracking } from "../../../../tracking/tracking-provider";
import { unity } from "../../../utils/general";

const MAP_PROVIDER = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;
const MINI_SPAN_DELTA = 0.01;

type MiniMapDockProps = {
  contactId: string;
  contactName: string;
};

/**
 * The chat-side view of someone's position.
 *
 * It only ever shows a live map when a watch session for this person is already
 * open — that is, when you arrived here from the map, having already told them
 * you were looking. Opening a chat on its own never reveals a position and
 * never notifies; the Track button does both, deliberately.
 */
export const MiniMapDock = ({ contactId, contactName }: MiniMapDockProps) => {
  const router = useRouter();
  const { trackees, activeWatches } = useTracking();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isLinked = trackees.some((link) => link.trackeeId === contactId);
  const isWatching = activeWatches.some(
    (watch) => watch.trackeeId === contactId,
  );
  const locations = useTrackeeLocations(isWatching ? [contactId] : []);
  const location = locations[contactId];

  if (!isLinked) return null;

  const openMap = () =>
    router.push({
      pathname: "/screens/TrackingScreen",
      params: { trackeeId: contactId, trackeeName: contactName },
    });

  // Not currently watching: a plain button. Tapping it opens the map, which is
  // what starts the session and tells them.
  if (!isWatching || isCollapsed || !location) {
    return (
      <Pressable
        style={styles.trackPill}
        onPress={openMap}
        accessibilityRole="button"
        accessibilityLabel={`Track ${contactName}`}
        accessibilityHint={`Opens the map and tells ${contactName} you're looking`}
      >
        <IconSymbol name="location.fill" size={14} color="#fff" />
        <Text style={styles.trackPillText}>Track</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.dock}>
      <Pressable
        onPress={openMap}
        accessibilityRole="button"
        accessibilityLabel={`Open the full map for ${contactName}`}
      >
        <MapView
          style={styles.miniMap}
          provider={MAP_PROVIDER}
          liteMode
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          pointerEvents="none"
          region={{
            latitude: location.lat,
            longitude: location.lng,
            latitudeDelta: MINI_SPAN_DELTA,
            longitudeDelta: MINI_SPAN_DELTA,
          }}
        />
        <View style={styles.miniPin}>
          <IconSymbol name="iphone" size={13} color="#fff" />
        </View>
      </Pressable>

      <View style={styles.dockFooter}>
        <Text style={styles.dockFooterText} numberOfLines={1}>
          {formatAge(location.capturedAt)}
        </Text>
        <Pressable
          onPress={() => setIsCollapsed(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Hide the map"
        >
          <IconSymbol name="chevron.up" size={13} color={Colors.light.icon} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    top: unity * 10,
    right: unity * 10,
    width: unity * 112,
    borderRadius: unity * 14,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: unity * 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: unity * 8,
    shadowOffset: { width: 0, height: unity * 3 },
    elevation: 5,
    zIndex: 20,
  },
  miniMap: { width: "100%", height: unity * 96 },
  miniPin: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -unity * 11,
    marginLeft: -unity * 11,
    width: unity * 22,
    height: unity * 22,
    borderRadius: unity * 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
    borderWidth: unity * 2,
    borderColor: "#fff",
  },
  dockFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: unity * 8,
    paddingVertical: unity * 5,
    gap: unity * 4,
  },
  dockFooterText: { fontSize: unity * 10, color: Colors.light.icon, flex: 1 },
  trackPill: {
    position: "absolute",
    top: unity * 10,
    right: unity * 10,
    flexDirection: "row",
    alignItems: "center",
    gap: unity * 5,
    paddingVertical: unity * 7,
    paddingHorizontal: unity * 11,
    borderRadius: unity * 15,
    backgroundColor: Colors.light.tint,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: unity * 5,
    shadowOffset: { width: 0, height: unity * 2 },
    elevation: 4,
    zIndex: 20,
  },
  trackPillText: { color: "#fff", fontWeight: "700", fontSize: unity * 12 },
});
