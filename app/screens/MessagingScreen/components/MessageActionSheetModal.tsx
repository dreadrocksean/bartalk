import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { QUICK_REPLY_EMOJIS } from "../constants";
import styles from "../styles";
import type { MessageActionSheetState } from "../types";
import { getMessageMedia } from "../utils";

type MessageActionSheetModalProps = {
  messageActionSheet: MessageActionSheetState | null;
  onClose: () => void;
  onQuickEmojiReply: (emoji: string) => void | Promise<void>;
  onReply: () => void;
  onCopy: () => void | Promise<void>;
  onSaveMedia: () => void | Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
};

export const MessageActionSheetModal = ({
  messageActionSheet,
  onClose,
  onQuickEmojiReply,
  onReply,
  onCopy,
  onSaveMedia,
  onEdit,
  onDelete,
}: MessageActionSheetModalProps) => {
  const mediaCount = messageActionSheet
    ? getMessageMedia(messageActionSheet.message).length
    : 0;
  const saveLabel =
    mediaCount > 1 ? `Save ${mediaCount} to Device` : "Save to Device";

  return (
    <Modal
      visible={Boolean(messageActionSheet)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.messageActionSheetOverlay}>
        <Pressable style={styles.messageActionSheetBackdrop} onPress={onClose} />
        <View style={styles.messageActionSheetCard}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.messageActionSheetEmojiScroll}
            contentContainerStyle={styles.messageActionSheetEmojiRow}
          >
            {QUICK_REPLY_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.messageActionSheetEmojiButton}
                onPress={() => void onQuickEmojiReply(emoji)}
              >
                <Text style={styles.messageActionSheetEmojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.messageActionSheetRow} onPress={onReply}>
            <Text style={styles.messageActionSheetRowText}>Reply</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.messageActionSheetRow}
            onPress={() => {
              void onCopy();
            }}
          >
            <Text style={styles.messageActionSheetRowText}>Copy</Text>
          </TouchableOpacity>
          {mediaCount > 0 ? (
            <TouchableOpacity
              style={styles.messageActionSheetRow}
              onPress={() => {
                void onSaveMedia();
              }}
            >
              <Text style={styles.messageActionSheetRowText}>{saveLabel}</Text>
            </TouchableOpacity>
          ) : null}
          {messageActionSheet?.isMe && messageActionSheet.canEdit ? (
            <TouchableOpacity style={styles.messageActionSheetRow} onPress={onEdit}>
              <Text style={styles.messageActionSheetRowText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          {messageActionSheet?.isMe ? (
            <TouchableOpacity style={styles.messageActionSheetRow} onPress={onDelete}>
              <Text style={styles.messageActionSheetDeleteText}>Delete</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.messageActionSheetRow} onPress={onClose}>
            <Text style={styles.messageActionSheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
