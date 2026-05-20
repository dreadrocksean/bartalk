import { Image as ExpoImage } from "expo-image";
import type { RefObject } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import styles from "../styles";
import type { PendingImage, ReplyTarget } from "../types";

type MessageComposerProps = {
  currentUserId: string | null;
  replyingTo: ReplyTarget | null;
  onClearReplyingTo: () => void;
  pendingImage: PendingImage | null;
  onOpenViewerImage: (uri: string) => void;
  onClearPendingImage: () => void;
  inputRef: RefObject<TextInput | null>;
  input: string;
  onInputChange: (text: string) => void;
  onOpenImageAttachmentActions: () => void | Promise<void>;
  onSend: () => void | Promise<void>;
  canSend: boolean;
  isSendingImage: boolean;
};

export const MessageComposer = ({
  currentUserId,
  replyingTo,
  onClearReplyingTo,
  pendingImage,
  onOpenViewerImage,
  onClearPendingImage,
  inputRef,
  input,
  onInputChange,
  onOpenImageAttachmentActions,
  onSend,
  canSend,
  isSendingImage,
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
      {pendingImage ? (
        <View style={styles.pendingImageComposer}>
          <TouchableOpacity
            onPress={() => onOpenViewerImage(pendingImage.previewUri)}
            activeOpacity={0.85}
          >
            <ExpoImage
              source={{ uri: pendingImage.previewUri }}
              style={styles.pendingImageThumb}
              contentFit="cover"
            />
          </TouchableOpacity>
          <View style={styles.pendingImageMetaWrap}>
            <Text style={styles.pendingImageMetaText}>Image attached</Text>
          </View>
          <TouchableOpacity onPress={onClearPendingImage} style={styles.pendingImageRemoveBtn}>
            <Text style={styles.pendingImageRemoveText}>x</Text>
          </TouchableOpacity>
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
            {isSendingImage ? "Sending..." : "Send"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
