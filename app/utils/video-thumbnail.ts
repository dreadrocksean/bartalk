// Poster frames for video attachments.
//
// Generated on demand from the video itself and kept in memory, so a chat full
// of clips renders as still images rather than mounting a player in every
// bubble. Nothing is uploaded: a thumbnail is a native image reference, and
// generating it here also gives posters to videos sent before this shipped.

import { createVideoPlayer, type VideoThumbnail } from "expo-video";

/** Far enough in to skip a black opening frame, but inside a very short clip. */
const THUMBNAIL_AT_SECONDS = 0.2;

const cache = new Map<string, VideoThumbnail | null>();
const inFlight = new Map<string, Promise<VideoThumbnail | null>>();

const generate = async (
  videoUrl: string,
  durationMs?: number,
): Promise<VideoThumbnail | null> => {
  let player: ReturnType<typeof createVideoPlayer> | null = null;
  try {
    player = createVideoPlayer({ uri: videoUrl });
    const durationSeconds =
      typeof durationMs === "number" && durationMs > 0
        ? durationMs / 1000
        : undefined;
    const at =
      durationSeconds !== undefined && durationSeconds < THUMBNAIL_AT_SECONDS
        ? 0
        : THUMBNAIL_AT_SECONDS;
    const [thumbnail] = await player.generateThumbnailsAsync([at]);
    return thumbnail ?? null;
  } catch (error) {
    // A missing poster is a plain dark tile, never a broken message.
    console.warn("Could not generate a video thumbnail:", error);
    return null;
  } finally {
    player?.release();
  }
};

/**
 * The poster for a video, or null if one can't be made. Repeated calls for the
 * same URL share one generation and then the cached result.
 */
export const getVideoThumbnail = async (
  videoUrl: string,
  durationMs?: number,
): Promise<VideoThumbnail | null> => {
  if (cache.has(videoUrl)) return cache.get(videoUrl) ?? null;

  const existing = inFlight.get(videoUrl);
  if (existing) return existing;

  const pending = generate(videoUrl, durationMs).then((thumbnail) => {
    cache.set(videoUrl, thumbnail);
    inFlight.delete(videoUrl);
    return thumbnail;
  });
  inFlight.set(videoUrl, pending);
  return pending;
};
