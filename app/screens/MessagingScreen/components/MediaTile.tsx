import { Image as ExpoImage } from "expo-image";
import type { VideoThumbnail } from "expo-video";
import { useEffect, useState } from "react";
import {
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { MessageMedia } from "../../../types/firestore";
import { getVideoThumbnail } from "../../../utils/video-thumbnail";
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
 * One attachment at bubble size. Videos show a poster frame with a play badge;
 * they play in the viewer, not here, so a long chat never mounts more than one
 * player at a time.
 */
export const MediaTile = ({
  media,
  style,
  showVideoChrome = true,
}: MediaTileProps) => {
  const isVideo = media.type === "video";
  const duration = formatMediaDuration(media.durationMs);
  const [poster, setPoster] = useState<VideoThumbnail | null>(null);

  useEffect(() => {
    if (!isVideo || !media.url) return;
    let isActive = true;
    void getVideoThumbnail(media.url, media.durationMs).then((thumbnail) => {
      if (isActive) setPoster(thumbnail);
    });
    return () => {
      isActive = false;
    };
  }, [isVideo, media.durationMs, media.url]);

  if (isVideo) {
    return (
      <View
        style={[styles.mediaTile, styles.videoTile, style as StyleProp<ViewStyle>]}
      >
        {poster ? (
          <ExpoImage
            source={poster}
            style={styles.mediaTileFill}
            contentFit="cover"
            transition={120}
          />
        ) : null}
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
