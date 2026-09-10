import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Marker } from "react-native-maps";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import { formatAge, isLocationStale } from "../../../../tracking/format";
import type { LocationDoc } from "../../../types/tracking";
import styles from "../styles";

type TrackeeMarkerProps = {
  trackeeId: string;
  name: string;
  location: LocationDoc;
  onPress: (trackeeId: string) => void;
};

/**
 * A phone with the person's name above it. Stale fixes go grey and start
 * showing their age — a pin that looks live when it is twenty minutes old is
 * worse than no pin, because it invites the wrong conclusion.
 */
export const TrackeeMarker = ({
  trackeeId,
  name,
  location,
  onPress,
}: TrackeeMarkerProps) => {
  const stale = isLocationStale(location);

  // Custom marker children are expensive to keep tracking, so redraws are
  // limited to a moment after the content actually changes.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 600);
    return () => clearTimeout(timer);
  }, [name, stale]);

  return (
    <Marker
      identifier={trackeeId}
      coordinate={{ latitude: location.lat, longitude: location.lng }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      onPress={() => onPress(trackeeId)}
    >
      <View style={styles.marker}>
        <View style={styles.markerLabel}>
          <Text style={styles.markerLabelText} numberOfLines={1}>
            {name}
          </Text>
          {stale ? (
            <Text style={styles.markerLabelAge}>
              {formatAge(location.capturedAt)}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.markerBody,
            stale ? styles.markerBodyStale : styles.markerBodyLive,
          ]}
        >
          <IconSymbol name="iphone" size={20} color="#fff" />
        </View>
        <View
          style={[
            styles.markerPointer,
            stale ? styles.markerPointerStale : styles.markerPointerLive,
          ]}
        />
      </View>
    </Marker>
  );
};
