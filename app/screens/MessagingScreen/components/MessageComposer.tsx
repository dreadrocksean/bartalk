import { Image as ExpoImage } from "expo-image";
import type { RefObject } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import styles from "../styles";
import type { PendingMedia, ReplyTarget } from "../types";
import { formatMediaDuration } from "../utils";

type MessageComposerProps = {
  currentUserId: string | null;
  replyingTo: ReplyTarget | null;
  onClearReplyingTo: () => void;
  pendingMedia: PendingMedia[];
  onPreviewPendingMedia: (mediaId: string) => void;
  onRemovePendingMedia: (mediaId: string) => void;
  onClearPendingMedia: () => void;
  inputRef: RefObject<TextInput | null>;
  input: string;
  onInputChange: (text: string) => void;
  onOpenImageAttachmentActions: () => void | Promise<void>;
  onSend: () => void | Promise<void>;
  canSend: boolean;
  isSendingMedia: boolean;
  /** "2 of 4" while a multi-attachment message uploads. */
  sendingProgressLabel: string | null;
};

const describePendingMedia = (pendingMedia: PendingMedia[]) => {
  if (pendingMedia.length === 1) {
    return pendingMedia[0].type === "video" ? "Video attached" : "Image attached";
  }
  return `${pendingMedia.length} attached`;
};

export const MessageComposer = ({
  currentUserId,
  replyingTo,
  onClearReplyingTo,
  pendingMedia,
  onPreviewPendingMedia,
  onRemovePendingMedia,
  onClearPendingMedia,
  inputRef,
  input,
  onInputChange,
  onOpenImageAttachmentActions,
  onSend,
  canSend,
  isSendingMedia,
  sendingProgressLabel,
}: MessageComposerProps) => {
  return (
    <View style={styles.composerContainer}>
      {replyingTo ? (
        <View style={styles.replyComposer}>
          <View style={styles.replyComposerTextWrap}>
            <Text style={styles.replyComposerLabel}>
              Replying to {replyingTo.senderId === currentUserId ? "You" : "Them"}
            </Text>
            <Text style={styles.replyComposerText} numberOfLines={1}>
              {replyingTo.snippet}
            </Text>
          </View>
          <TouchableOpacity onPress={onClearReplyingTo} style={styles.replyComposerClose}>
            <Text style={styles.replyComposerCloseText}>x</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {pendingMedia.length > 0 ? (
        <View style={styles.pendingMediaComposer}>
          <View style={styles.pendingMediaHeaderRow}>
            <Text style={styles.pendingImageMetaText}>
              {describePendingMedia(pendingMedia)}
            </Text>
            {pendingMedia.length > 1 ? (
              <TouchableOpacity onPress={onClearPendingMedia}>
                <Text style={styles.pendingMediaClearAllText}>Remove all</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pendingMediaStrip}
            keyboardShouldPersistTaps="handled"
          >
            {pendingMedia.map((item) => {
              const duration = formatMediaDuration(item.durationMs);
              return (
                <View key={item.id} style={styles.pendingMediaItem}>
                  <TouchableOpacity
                    onPress={() => onPreviewPendingMedia(item.id)}
                    activeOpacity={0.85}
                  >
                    <ExpoImage
                      source={{ uri: item.previewUri }}
                      style={styles.pendingMediaThumb}
                      contentFit="cover"
                    />
                    {item.type === "video" ? (
                      <View style={styles.pendingMediaVideoOverlay}>
                        <Text style={styles.pendingMediaVideoGlyph}>▶</Text>
                        {duration ? (
                          <Text style={styles.pendingMediaVideoDuration}>
                            {duration}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onRemovePendingMedia(item.id)}
                    style={styles.pendingImageRemoveBtn}
                  >
                    <Text style={styles.pendingImageRemoveText}>x</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.inputBar}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={() => {
            void onOpenImageAttachmentActions();
          }}
        >
          <Text style={styles.attachBtnText}>+</Text>
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={onInputChange}
          placeholder="iMessage"
          placeholderTextColor="#aaa"
          onSubmitEditing={() => {
            void onSend();
          }}
          returnKeyType="send"
        />
        <TouchableOpacity
          onPress={() => {
            void onSend();
          }}
          style={[styles.sendBtn, !canSend ? styles.sendBtnDisabled : null]}
          disabled={!canSend}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            {isSendingMedia ? (sendingProgressLabel ?? "Sending...") : "Send"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
