import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "../../../components/ui/icon-symbol";
import { Colors } from "../../../constants/theme";
import { useAutoFitMap } from "../../../hooks/use-auto-fit-map";
import { useMyPosition } from "../../../hooks/use-my-position";
import { useTrackeeLocations } from "../../../hooks/use-trackee-locations";
import { useWatchScope } from "../../../hooks/use-watch-scope";
import { formatAge } from "../../../tracking/format";
import { useTracking, type WatchTarget } from "../../../tracking/tracking-provider";
import type { LatLng } from "../../types/tracking";
import { AutoFitChip } from "./components/AutoFitChip";
import {
  OtherTrackeesMenu,
  type TrackeeOption,
} from "./components/OtherTrackeesMenu";
import { TrackeeMarker } from "./components/TrackeeMarker";
import { WatchNoticeChip } from "./components/WatchNoticeChip";
import styles from "./styles";

// Android needs the Google provider explicitly; iOS uses Apple Maps, which
// avoids pulling the Google Maps SDK into a static-frameworks iOS build.
const MAP_PROVIDER = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

const TrackingScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { trackeeId, trackeeName } = useLocalSearchParams();

  const {
    trackees,
    activeWatches,
    addWatchTarget,
    removeWatchTarget,
  } = useTracking();

  const requestedTarget = useMemo<WatchTarget[]>(() => {
    const id = typeof trackeeId === "string" ? trackeeId.trim() : "";
    if (!id) return [];
    const link = trackees.find((candidate) => candidate.trackeeId === id);
    const name =
      link?.trackeeName ??
      (typeof trackeeName === "string" ? trackeeName : "") ??
      "";
    return [{ trackeeId: id, trackeeName: name || "Trackee" }];
  }, [trackeeId, trackeeName, trackees]);

  // Declaring the scope is what opens the sessions, and opening a session is
  // what notifies. There is no separate "notify" call to forget.
  useWatchScope("watch", requestedTarget);

  const watchedIds = useMemo(
    () => activeWatches.map((watch) => watch.trackeeId),
    [activeWatches],
  );
  const locations = useTrackeeLocations(watchedIds);
  const { position: myPosition } = useMyPosition(true);

  const coordinates = useMemo<LatLng[]>(() => {
    const result: LatLng[] = [];
    if (myPosition) result.push(myPosition);
    watchedIds.forEach((id) => {
      const location = locations[id];
      if (location) {
        result.push({ latitude: location.lat, longitude: location.lng });
      }
    });
    return result;
  }, [locations, myPosition, watchedIds]);

  const { mapRef, isManual, secondsRemaining, resumeAutoFit, autoFitMapProps } =
    useAutoFitMap(coordinates);

  useEffect(() => {
    navigation.setOptions({ title: "Track", headerBackTitle: "Trackees" });
  }, [navigation]);

  const openChat = useCallback(
    (id: string) => {
      const watch = activeWatches.find((candidate) => candidate.trackeeId === id);
      router.push({
        pathname: "/screens/MessagingScreen",
        params: { contactId: id, contactName: watch?.trackeeName ?? "" },
      });
    },
    [activeWatches, router],
  );

  const otherTrackees = useMemo<TrackeeOption[]>(
    () =>
      trackees
        .filter((link) => !watchedIds.includes(link.trackeeId))
        .map((link) => ({
          trackeeId: link.trackeeId,
          name: link.trackeeName,
          paused: link.pausedByTrackee,
        })),
    [trackees, watchedIds],
  );

  if (trackees.length === 0) {
    return (
      <View style={styles.centered}>
        <IconSymbol name="map.fill" size={44} color={Colors.light.icon} />
        <Text style={styles.emptyTitle}>Nobody is sharing with you yet</Text>
        <Text style={styles.emptyBody}>
          Ask someone to share their location from the Track tab. They decide
          whether to accept, and they can stop at any time.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Back to trackees</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={MAP_PROVIDER}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        {...autoFitMapProps}
      >
        {activeWatches.map((watch) => {
          const location = locations[watch.trackeeId];
          if (!location) return null;
          return (
            <TrackeeMarker
              key={watch.trackeeId}
              trackeeId={watch.trackeeId}
              name={watch.trackeeName}
              location={location}
              onPress={openChat}
            />
          );
        })}
      </MapView>

      <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        <WatchNoticeChip
          names={activeWatches.map((watch) => watch.trackeeName)}
        />

        <View style={styles.watchedRow}>
          {activeWatches.map((watch) => {
            const location = locations[watch.trackeeId];
            return (
              <View key={watch.trackeeId} style={styles.watchedChip}>
                <Text style={styles.watchedChipText}>{watch.trackeeName}</Text>
                <Text style={styles.watchedChipAge}>
                  {formatAge(location?.capturedAt)}
                </Text>
                <Pressable
                  onPress={() => removeWatchTarget(watch.trackeeId)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Stop tracking ${watch.trackeeName}`}
                >
                  <IconSymbol name="xmark" size={13} color={Colors.light.icon} />
                </Pressable>
              </View>
            );
          })}
        </View>

        <OtherTrackeesMenu
          options={otherTrackees}
          onSelect={(option) =>
            addWatchTarget({
              trackeeId: option.trackeeId,
              trackeeName: option.name,
            })
          }
        />
      </View>

      {isManual ? (
        <AutoFitChip
          secondsRemaining={secondsRemaining}
          bottom={insets.bottom + 24}
          onPress={resumeAutoFit}
        />
      ) : null}
    </View>
  );
};

export default TrackingScreen;
