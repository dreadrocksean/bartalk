import { Image as ExpoImage } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MessageMedia } from "../../../types/firestore";
import { saveMediaToDevice } from "../../../utils/media-download";
import styles from "../styles";
import type { MediaViewerState } from "../types";
import { formatMediaDuration } from "../utils";

type MediaViewerModalProps = {
  viewerState: MediaViewerState | null;
  onClose: () => void;
};

/**
 * Full-screen attachment viewer: swipe between everything on the message, and
 * save the one on screen to the phone.
 *
 * Videos open in the system viewer rather than playing in place — see
 * `MediaTile` for why.
 */
export const MediaViewerModal = ({
  viewerState,
  onClose,
}: MediaViewerModalProps) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<MessageMedia>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const items = viewerState?.items ?? [];
  const openedAtIndex = viewerState?.index ?? 0;

  useEffect(() => {
    if (!viewerState) return;
    setActiveIndex(openedAtIndex);
    setIsSaving(false);
  }, [openedAtIndex, viewerState]);

  const handleMomentumScrollEnd = useCallback(
    ({ nativeEvent }: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (width <= 0) return;
      setActiveIndex(Math.round(nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const activeMedia = items[activeIndex];
  // The composer previews not-yet-sent attachments through this same viewer.
  // Those are local files with nothing to download and nothing to play in a
  // browser, so the actions that need a remote file stay hidden.
  const isRemote = /^https?:/i.test(activeMedia?.url ?? "");

  const handleSave = useCallback(async () => {
    if (!activeMedia || isSaving || !isRemote) return;
    setIsSaving(true);
    try {
      const result = await saveMediaToDevice(activeMedia);
      if (result.status === "failed") {
        Alert.alert("Couldn't save", result.reason);
      }
    } finally {
      setIsSaving(false);
    }
  }, [activeMedia, isRemote, isSaving]);

  const handleOpenVideo = useCallback(async () => {
    if (!activeMedia?.url || !/^https?:/i.test(activeMedia.url)) return;
    try {
      await WebBrowser.openBrowserAsync(activeMedia.url);
    } catch (error) {
      console.error("Failed to open video:", error);
      Alert.alert("Couldn't play that video.");
    }
  }, [activeMedia]);

  const renderItem = useCallback(
    ({ item }: { item: MessageMedia }) => {
      if (item.type === "video") {
        const duration = formatMediaDuration(item.durationMs);
        const isPlayable = /^https?:/i.test(item.url);
        return (
          <Pressable
            style={[
              styles.mediaViewerPage,
              styles.mediaViewerVideoPlaceholder,
              { width, height },
            ]}
            onPress={() => {
              void handleOpenVideo();
            }}
          >
            <View style={styles.videoPlayBadge}>
              <Text style={styles.videoPlayGlyph}>▶</Text>
            </View>
            <Text style={styles.mediaViewerVideoHint}>
              {isPlayable
                ? duration
                  ? `Tap to play · ${duration}`
                  : "Tap to play"
                : duration || "Video"}
            </Text>
          </Pressable>
        );
      }

      return (
        <View style={[styles.mediaViewerPage, { width, height }]}>
          <ExpoImage
            source={{ uri: item.url }}
            style={{ width, height }}
            contentFit="contain"
          />
        </View>
      );
    },
    [handleOpenVideo, height, width],
  );

  return (
    <Modal
      visible={Boolean(viewerState)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.mediaViewerBackdrop}>
        <FlatList
          ref={listRef}
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.storagePath || item.url}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={openedAtIndex}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        />
        <View style={[styles.mediaViewerTopBar, { top: insets.top + 12 }]}>
          <TouchableOpacity style={styles.mediaViewerButton} onPress={onClose}>
            <Text style={styles.mediaViewerButtonText}>Done</Text>
          </TouchableOpacity>
          {items.length > 1 ? (
            <Text style={styles.mediaViewerCounter}>
              {activeIndex + 1} of {items.length}
            </Text>
          ) : null}
          {isRemote ? (
            <TouchableOpacity
              style={[
                styles.mediaViewerButton,
                isSaving ? styles.mediaViewerButtonDisabled : null,
              ]}
              disabled={isSaving}
              onPress={() => {
                void handleSave();
              }}
            >
              <Text style={styles.mediaViewerButtonText}>
                {isSaving ? "Saving…" : "Save"}
              </Text>
            </TouchableOpacity>
          ) : (
            // Keeps "Done" and the counter where they were.
            <View style={styles.mediaViewerButtonSpacer} />
          )}
        </View>
      </View>
    </Modal>
  );
};
