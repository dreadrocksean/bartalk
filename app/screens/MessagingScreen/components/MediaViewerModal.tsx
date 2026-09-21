import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MessageMedia } from "../../../types/firestore";
import { saveMediaToDevice, shareMedia } from "../../../utils/media-download";
import styles from "../styles";
import type { MediaViewerState } from "../types";
import { MediaViewerPage } from "./MediaViewerPage";

type MediaViewerModalProps = {
  viewerState: MediaViewerState | null;
  onClose: () => void;
};

/**
 * Full-screen attachment viewer: swipe between everything on the message, play
 * the videos, and save or share the one on screen.
 */
export const MediaViewerModal = ({
  viewerState,
  onClose,
}: MediaViewerModalProps) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [busyAction, setBusyAction] = useState<"save" | "share" | null>(null);

  const items = viewerState?.items ?? [];
  const openedAtIndex = viewerState?.index ?? 0;

  useEffect(() => {
    if (!viewerState) return;
    setActiveIndex(openedAtIndex);
    setBusyAction(null);
  }, [openedAtIndex, viewerState]);

  const handleMomentumScrollEnd = useCallback(
    ({ nativeEvent }: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (width <= 0) return;
      setActiveIndex(Math.round(nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const activeMedia = items[activeIndex];
  // The composer previews not-yet-sent attachments through this same viewer,
  // and a local file has nothing to fetch.
  const isRemote = /^https?:/i.test(activeMedia?.url ?? "");

  const runAction = useCallback(
    async (action: "save" | "share") => {
      if (!activeMedia || busyAction || !isRemote) return;
      setBusyAction(action);
      try {
        const result = await (action === "save"
          ? saveMediaToDevice(activeMedia)
          : shareMedia(activeMedia));
        if (result.status === "failed") {
          Alert.alert(action === "save" ? "Couldn't save" : "Couldn't share", result.reason);
        }
      } finally {
        setBusyAction(null);
      }
    },
    [activeMedia, busyAction, isRemote],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: MessageMedia; index: number }) => (
      <MediaViewerPage
        media={item}
        width={width}
        height={height}
        isActive={index === activeIndex}
      />
    ),
    [activeIndex, height, width],
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
            <View style={styles.mediaViewerActions}>
              <TouchableOpacity
                style={[
                  styles.mediaViewerButton,
                  busyAction ? styles.mediaViewerButtonDisabled : null,
                ]}
                disabled={Boolean(busyAction)}
                onPress={() => {
                  void runAction("share");
                }}
              >
                <Text style={styles.mediaViewerButtonText}>
                  {busyAction === "share" ? "…" : "Share"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.mediaViewerButton,
                  styles.mediaViewerButtonTrailing,
                  busyAction ? styles.mediaViewerButtonDisabled : null,
                ]}
                disabled={Boolean(busyAction)}
                onPress={() => {
                  void runAction("save");
                }}
              >
                <Text style={styles.mediaViewerButtonText}>
                  {busyAction === "save" ? "Saving…" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Keeps "Done" and the counter where they were.
            <View style={styles.mediaViewerButtonSpacer} />
          )}
        </View>
      </View>
    </Modal>
  );
};
