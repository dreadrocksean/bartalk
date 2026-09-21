import { Image as ExpoImage } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import type { MessageMedia } from "../../../types/firestore";
import { ZoomableMedia } from "./ZoomableMedia";

type MediaViewerPageProps = {
  media: MessageMedia;
  width: number;
  height: number;
  /** Only the page on screen holds a playing player. */
  isActive: boolean;
  /** Tapping a still dismisses the viewer; taps on a video work its controls. */
  onPressBackdrop: () => void;
  onZoomChange: (isZoomed: boolean) => void;
};

/**
 * The size the content actually occupies once letterboxed into the page, which
 * is what the pan limits have to be measured against — not the page itself.
 */
const fitWithin = (
  media: MessageMedia,
  width: number,
  height: number,
) => {
  const ratio =
    media.width && media.height && media.height > 0
      ? media.width / media.height
      : width / height;
  const boxRatio = width / height;
  return ratio > boxRatio
    ? { width, height: width / ratio }
    : { width: height * ratio, height };
};

const VideoPage = ({
  media,
  width,
  height,
  isActive,
  onZoomChange,
}: MediaViewerPageProps) => {
  const player = useVideoPlayer({ uri: media.url }, (instance) => {
    instance.loop = false;
  });

  // Swiping away from a clip should stop it, not leave it playing off-screen.
  useEffect(() => {
    if (!isActive) player.pause();
  }, [isActive, player]);

  const fitted = fitWithin(media, width, height);

  return (
    <ZoomableMedia
      width={width}
      height={height}
      contentWidth={fitted.width}
      contentHeight={fitted.height}
      isActive={isActive}
      onZoomChange={onZoomChange}
    >
      <VideoView
        player={player}
        style={{ width, height }}
        contentFit="contain"
        nativeControls
        allowsFullscreen
      />
    </ZoomableMedia>
  );
};

/** One page of the full-screen viewer: a still, or a playable video. */
export const MediaViewerPage = (props: MediaViewerPageProps) => {
  if (props.media.type === "video") {
    return <VideoPage {...props} />;
  }

  const { media, width, height, isActive, onPressBackdrop, onZoomChange } = props;
  const fitted = fitWithin(media, width, height);

  return (
    <ZoomableMedia
      width={width}
      height={height}
      contentWidth={fitted.width}
      contentHeight={fitted.height}
      isActive={isActive}
      onZoomChange={onZoomChange}
      onTap={onPressBackdrop}
    >
      <ExpoImage
        source={{ uri: media.url }}
        style={{ width, height }}
        contentFit="contain"
      />
    </ZoomableMedia>
  );
};
