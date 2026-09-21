import { Image as ExpoImage } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import type { MessageMedia } from "../../../types/firestore";
import styles from "../styles";

type MediaViewerPageProps = {
  media: MessageMedia;
  width: number;
  height: number;
  /** Only the page on screen holds a playing player. */
  isActive: boolean;
  /** Tapping a still dismisses the viewer; taps on a video work its controls. */
  onPressBackdrop: () => void;
};

const VideoPage = ({ media, width, height, isActive }: MediaViewerPageProps) => {
  const player = useVideoPlayer({ uri: media.url }, (instance) => {
    instance.loop = false;
  });

  // Swiping away from a clip should stop it, not leave it playing off-screen.
  useEffect(() => {
    if (!isActive) player.pause();
  }, [isActive, player]);

  return (
    <View style={[styles.mediaViewerPage, { width, height }]}>
      <VideoView
        player={player}
        style={{ width, height }}
        contentFit="contain"
        nativeControls
        allowsFullscreen
      />
    </View>
  );
};

/** One page of the full-screen viewer: a still, or a playable video. */
export const MediaViewerPage = (props: MediaViewerPageProps) => {
  if (props.media.type === "video") {
    return <VideoPage {...props} />;
  }

  const { media, width, height, onPressBackdrop } = props;
  return (
    <Pressable
      style={[styles.mediaViewerPage, { width, height }]}
      onPress={onPressBackdrop}
    >
      <ExpoImage
        source={{ uri: media.url }}
        style={{ width, height }}
        contentFit="contain"
      />
    </Pressable>
  );
};
