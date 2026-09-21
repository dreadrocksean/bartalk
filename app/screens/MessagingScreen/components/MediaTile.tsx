import { Image as ExpoImage } from "expo-image";
import {
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { MessageMedia } from "../../../types/firestore";
import styles from "../styles";
import { formatMediaDuration } from "../utils";

type MediaTileProps = {
  media: MessageMedia;
  /** Sizing only — the same values have to work on a View and on an Image. */
  style?: StyleProp<ImageStyle>;
  /** Back layers of a fanned stack carry no play badge or duration. */
  showVideoChrome?: boolean;
};

/**
 * One attachment at bubble size.
 *
 * Videos are drawn rather than played: this binary has no video component, and
 * pulling one in would cost a store release. Tapping opens the file in the
 * system viewer instead, which plays it with the platform's own controls.
 */
export const MediaTile = ({
  media,
  style,
  showVideoChrome = true,
}: MediaTileProps) => {
  const isVideo = media.type === "video";
  const duration = formatMediaDuration(media.durationMs);

  if (isVideo) {
    return (
      <View
        style={[styles.mediaTile, styles.videoTile, style as StyleProp<ViewStyle>]}
      >
        {showVideoChrome ? (
          <>
            <View style={styles.videoPlayBadge}>
              <Text style={styles.videoPlayGlyph}>▶</Text>
            </View>
            {duration ? (
              <View style={styles.videoDurationPill}>
                <Text style={styles.videoDurationText}>{duration}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    );
  }

  return (
    <ExpoImage
      source={{ uri: media.url }}
      style={[styles.mediaTile, style]}
      contentFit="cover"
      transition={120}
    />
  );
};
