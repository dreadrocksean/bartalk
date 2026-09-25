// cspell:ignore ReanimatedSwipeable swipeable
import { LinearGradient } from "expo-linear-gradient";
import { useRef } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import type { MessageDoc, MessageMedia } from "../../../types/firestore";
import {
  MY_BUBBLE_GRADIENT_COLORS,
  SWIPE_ANIMATION_OPTIONS,
} from "../constants";
import styles from "../styles";
import { getMessageMedia } from "../utils";
import { MediaStack } from "./MediaStack";
import { MessageText } from "./MessageText";

type MessageRowProps = {
  message: MessageDoc;
  currentUserId: string | null;
  highlightedMessageId: string | null;
  editingId: string | null;
  editingText: string;
  onEditingTextChange: (text: string) => void;
  onMessageLongPress: (message: MessageDoc, isMe: boolean) => void;
  onSwipeOpen: (
    messageId: string,
    swipeable: Pick<SwipeableMethods, "close">,
  ) => void;
  onSwipeClose: (messageId: string) => void;
  onJumpToOriginalMessage: (messageId: string) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onOpenMediaViewer: (media: MessageMedia[], index: number) => void;
  formatMessageTime: (timestamp: number) => string;
};

export const MessageRow = ({
  message,
  currentUserId,
  highlightedMessageId,
  editingId,
  editingText,
  onEditingTextChange,
  onMessageLongPress,
  onSwipeOpen,
  onSwipeClose,
  onJumpToOriginalMessage,
  onEditCancel,
  onEditSave,
  onOpenMediaViewer,
  formatMessageTime: formatTime,
}: MessageRowProps) => {
  const isMe = message.sender === currentUserId;
  const isHighlighted = highlightedMessageId === message.id;
  const replyTo = message.replyTo;
  const messageText = typeof message.text === "string" ? message.text : "";
  const hasText = messageText.trim().length > 0;
  const messageMedia = getMessageMedia(message);
  const hasMedia = messageMedia.length > 0;
  const messageTime = formatTime(message.timestamp);
  const reactionCounts = new Map<string, number>();
  Object.values(message.reactions ?? {}).forEach((reactionEmoji) => {
    if (typeof reactionEmoji !== "string") return;
    const normalizedReaction = reactionEmoji.trim();
    if (!normalizedReaction) return;
    reactionCounts.set(
      normalizedReaction,
      (reactionCounts.get(normalizedReaction) ?? 0) + 1,
    );
  });
  const reactionBadges = Array.from(reactionCounts.entries()).map(
    ([reactionEmoji, count]) => ({
      emoji: reactionEmoji,
      count,
    }),
  );
  const hasReaction = reactionBadges.length > 0;
  const swipeableRef = useRef<SwipeableMethods | null>(null);

  return (
    <View
      style={[
        styles.messageSwipeRow,
        isMe ? styles.messageSwipeRowMe : styles.messageSwipeRowOther,
      ]}
    >
      <ReanimatedSwipeable
        ref={swipeableRef}
        containerStyle={styles.messageSwipeable}
        childrenContainerStyle={styles.messageSwipeChildren}
        overshootLeft={false}
        overshootRight={false}
        leftThreshold={36}
        rightThreshold={36}
        friction={2}
        animationOptions={SWIPE_ANIMATION_OPTIONS}
        onSwipeableOpen={() => {
          const swipeable = swipeableRef.current;
          if (!swipeable) {
            return;
          }
          onSwipeOpen(message.id, swipeable);
        }}
        onSwipeableClose={() => {
          onSwipeClose(message.id);
        }}
        renderLeftActions={
          isMe
            ? undefined
            : () => (
                <View
                  style={[
                    styles.messageTimestampReveal,
                    styles.messageTimestampRevealLeft,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageTimestampRevealText,
                      styles.messageTimestampRevealTextLeft,
                    ]}
                  >
                    {messageTime}
                  </Text>
                </View>
              )
        }
        renderRightActions={
          isMe
            ? () => (
                <View
                  style={[
                    styles.messageTimestampReveal,
                    styles.messageTimestampRevealRight,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageTimestampRevealText,
                      styles.messageTimestampRevealTextRight,
                    ]}
                  >
                    {messageTime}
                  </Text>
                </View>
              )
            : undefined
        }
      >
        <TouchableOpacity
          onLongPress={() => onMessageLongPress(message, isMe)}
          style={[
            styles.bubble,
            isMe ? styles.bubbleMe : styles.bubbleOther,
            isHighlighted ? styles.bubbleHighlighted : null,
            hasReaction ? styles.bubbleReactionOffset : null,
          ]}
          activeOpacity={0.7}
        >
          {isMe ? (
            <LinearGradient
              colors={MY_BUBBLE_GRADIENT_COLORS}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.bubbleMeGradient}
              pointerEvents="none"
            />
          ) : null}
          {hasReaction ? (
            <View
              style={[
                styles.reactionBubbleRow,
                isMe ? styles.reactionBubbleRowMe : styles.reactionBubbleRowOther,
              ]}
            >
              {reactionBadges.map((reactionBadge) => (
                <View
                  key={reactionBadge.emoji}
                  style={[
                    styles.reactionBubble,
                    isMe ? styles.reactionBubbleMe : styles.reactionBubbleOther,
                  ]}
                >
                  <Text style={styles.reactionBubbleEmoji}>{reactionBadge.emoji}</Text>
                  {reactionBadge.count > 1 ? (
                    <Text style={styles.reactionBubbleCount}>{reactionBadge.count}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          {editingId === message.id ? (
            <View style={styles.editContainer}>
              <TextInput
                value={editingText}
                onChangeText={onEditingTextChange}
                style={styles.editInput}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
                autoFocus
              />
              <View style={styles.editActions}>
                <TouchableOpacity onPress={onEditCancel} style={styles.editCancelBtn}>
                  <Text style={styles.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onEditSave} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.bubbleContent}>
              {replyTo ? (
                <TouchableOpacity
                  onPress={() => onJumpToOriginalMessage(replyTo.messageId)}
                  style={[
                    styles.replyQuote,
                    isMe ? styles.replyQuoteMe : styles.replyQuoteOther,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.replyQuoteLabel,
                      isMe ? styles.replyQuoteLabelMe : styles.replyQuoteLabelOther,
                    ]}
                  >
                    Replying to {replyTo.senderId === currentUserId ? "You" : "Them"}
                  </Text>
                  <Text
                    style={[
                      styles.replyQuoteText,
                      isMe ? styles.replyQuoteTextMe : styles.replyQuoteTextOther,
                    ]}
                    numberOfLines={2}
                  >
                    {replyTo.deleted ? "Original message unavailable" : replyTo.snippet}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {hasText ? (
                <MessageText
                  text={messageText}
                  isMe={isMe}
                  onLongPress={() => onMessageLongPress(message, isMe)}
                />
              ) : null}
              {hasMedia ? (
                <View style={hasText ? styles.messageImageWrapWithText : null}>
                  <MediaStack
                    media={messageMedia}
                    onPress={(index) => onOpenMediaViewer(messageMedia, index)}
                  />
                </View>
              ) : null}
              {message.edited && hasText ? (
                <Text style={styles.edited}>(edited)</Text>
              ) : null}
            </View>
          )}
        </TouchableOpacity>
      </ReanimatedSwipeable>
    </View>
  );
};
