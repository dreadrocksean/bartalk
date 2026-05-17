import { getAuth } from "@react-native-firebase/auth";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { TypingIndicatorDots } from "../../../components/typing-indicator-dots";

import {
  editMessage,
  getOrCreateConversation,
  getUserExpoPushToken,
  listenForConversation,
  listenForMessages,
  markConversationRead,
  sendMessage,
  setConversationTyping,
} from "../../../api";

import {
  ConversationDoc,
  MessageDoc,
  ReplyReference,
} from "../../types/firestore";

import { Colors } from "../../../constants/theme";
import styles from "./styles";

const TYPING_PAUSE_MS = 1500;
const TYPING_STALE_MS = 5000;
const MESSAGE_HIGHLIGHT_MS = 1800;
const QUICK_REPLY_EMOJIS = [
  "❤️",
  "👍",
  "👎",
  "😂",
  "🔥",
  "😮",
  "??",
  "🙏",
  "😍",
  "👏",
  "😭",
  "🙌",
  "🤔",
  "😅",
  "🎉",
  "✅",
  "👀",
  "💯",
  "🤝",
  "😎",
] as const;

type ReplyTarget = Required<Pick<ReplyReference, "messageId" | "senderId" | "snippet">> & {
  type: "text";
};

type MessageActionSheetState = {
  isMe: boolean;
  message: MessageDoc;
};

const MessagingScreen = () => {
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({
      title: "Messages",
      headerBackTitle: "Contacts",
    });
  }, [navigation]);
  const { contactId } = useLocalSearchParams();
  const contactIdValue = String(contactId);
  const currentUserId = getAuth().currentUser?.uid ?? null;
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [isOtherPartyTyping, setIsOtherPartyTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const remoteTypingExpiryTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const isCurrentUserTypingRef = useRef(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [receiverPushToken, setReceiverPushToken] = useState<string | null>(
    null,
  );
  const [messageActionSheet, setMessageActionSheet] =
    useState<MessageActionSheetState | null>(null);

  const clearTypingStopTimeout = useCallback(() => {
    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
  }, []);

  const clearRemoteTypingExpiryTimeout = useCallback(() => {
    if (remoteTypingExpiryTimeoutRef.current) {
      clearTimeout(remoteTypingExpiryTimeoutRef.current);
      remoteTypingExpiryTimeoutRef.current = null;
    }
  }, []);

  const clearHighlightTimeout = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  const syncMyTypingState = useCallback(
    async (isTyping: boolean, targetConversationId?: string) => {
      const convoId = targetConversationId ?? conversationId;
      if (!convoId || !currentUserId) return;
      if (isCurrentUserTypingRef.current === isTyping) return;
      try {
        await setConversationTyping({
          conversationId: convoId,
          userId: currentUserId,
          isTyping,
        });
        isCurrentUserTypingRef.current = isTyping;
      } catch (error) {
        console.error("Failed to update typing status:", error);
      }
    },
    [conversationId, currentUserId],
  );

  const scheduleTypingStop = useCallback(
    (targetConversationId?: string) => {
      clearTypingStopTimeout();
      typingStopTimeoutRef.current = setTimeout(() => {
        void syncMyTypingState(false, targetConversationId);
      }, TYPING_PAUSE_MS);
    },
    [clearTypingStopTimeout, syncMyTypingState],
  );

  const handleInputChange = useCallback(
    (text: string) => {
      setInput(text);
      if (!conversationId || !currentUserId) return;

      if (text.trim().length === 0) {
        clearTypingStopTimeout();
        void syncMyTypingState(false);
        return;
      }

      void syncMyTypingState(true);
      scheduleTypingStop();
    },
    [
      clearTypingStopTimeout,
      conversationId,
      currentUserId,
      scheduleTypingStop,
      syncMyTypingState,
    ],
  );

  useEffect(
    () => () => {
      clearHighlightTimeout();
    },
    [clearHighlightTimeout],
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      let activeConversationId: string | null = null;
      let unsubscribeMessages: (() => void) | null = null;
      let unsubscribeConversation: (() => void) | null = null;
      (async () => {
        const currentUser = getAuth().currentUser;
        if (!currentUser) return;
        try {
          const pushToken = await getUserExpoPushToken(contactIdValue);
          setReceiverPushToken(pushToken);
        } catch {
          setReceiverPushToken(null);
        }
        const convoRef = await getOrCreateConversation(
          currentUser.uid,
          contactIdValue,
        );
        if (!isActive) return;
        setConversationId(convoRef.id);
        activeConversationId = convoRef.id;

        unsubscribeConversation = listenForConversation(
          convoRef.id,
          (rawConversation) => {
            if (!isActive) return;
            const conversation = rawConversation as Omit<
              ConversationDoc,
              "id"
            > | null;
            const typingStatus = conversation?.typingStatus?.[contactIdValue];
            const updatedAt = typingStatus?.updatedAt ?? 0;
            const remainingMs = TYPING_STALE_MS - (Date.now() - updatedAt);

            clearRemoteTypingExpiryTimeout();

            if (!typingStatus?.isTyping || remainingMs <= 0) {
              setIsOtherPartyTyping(false);
              return;
            }

            setIsOtherPartyTyping(true);
            remoteTypingExpiryTimeoutRef.current = setTimeout(() => {
              setIsOtherPartyTyping(false);
            }, remainingMs);
          },
        );

        unsubscribeMessages = listenForMessages(
          convoRef.id,
          async (msgs: MessageDoc[]) => {
            if (!isActive) return;
            setMessages(msgs.sort((a, b) => a.timestamp - b.timestamp));
            if (msgs.length > 0) {
              const lastMsg = msgs[msgs.length - 1];
              if (lastMsg.sender && lastMsg.sender !== currentUser.uid) {
                await markConversationRead({
                  conversationId: convoRef.id,
                  userId: currentUser.uid,
                  lastReadMessageId: lastMsg.id,
                  lastMessageTimestamp: lastMsg.timestamp,
                  lastReadTimestamp: new Date().getTime(),
                });
              }
            }
            setTimeout(
              () => flatListRef.current?.scrollToEnd({ animated: true }),
              100,
            );
          },
        );
      })();
      return () => {
        isActive = false;
        clearTypingStopTimeout();
        clearRemoteTypingExpiryTimeout();
        clearHighlightTimeout();
        setIsOtherPartyTyping(false);
        setReplyingTo(null);
        setHighlightedMessageId(null);
        setMessageActionSheet(null);
        setConversationId(null);
        if (
          activeConversationId &&
          currentUserId &&
          isCurrentUserTypingRef.current
        ) {
          void setConversationTyping({
            conversationId: activeConversationId,
            userId: currentUserId,
            isTyping: false,
          });
          isCurrentUserTypingRef.current = false;
        }
        if (unsubscribeConversation) unsubscribeConversation();
        if (unsubscribeMessages) unsubscribeMessages();
      };
    }, [
      clearRemoteTypingExpiryTimeout,
      clearHighlightTimeout,
      clearTypingStopTimeout,
      contactIdValue,
      currentUserId,
    ]),
  );

  const makeReplySnippet = useCallback((text: string) => {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return "Message";
    if (normalized.length > 100) {
      return `${normalized.slice(0, 97)}...`;
    }
    return normalized;
  }, []);

  const handleEdit = useCallback((id: string, text: string) => {
    setReplyingTo(null);
    setEditingId(id);
    setEditingText(text);
  }, []);

  const handleReplyToMessage = useCallback(
    (message: MessageDoc) => {
      setEditingId(null);
      setEditingText("");
      setReplyingTo({
        messageId: message.id,
        senderId: message.sender,
        snippet: makeReplySnippet(message.text),
        type: "text",
      });
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [makeReplySnippet],
  );

  const closeMessageActionSheet = useCallback(() => {
    setMessageActionSheet(null);
  }, []);

  const handleQuickEmojiReply = useCallback(
    async (emoji: string) => {
      if (!conversationId || !messageActionSheet) return;
      const currentUser = getAuth().currentUser;
      if (!currentUser) return;

      closeMessageActionSheet();
      clearTypingStopTimeout();
      void syncMyTypingState(false);

      const targetMessage = messageActionSheet.message;
      const outgoingMessage: Parameters<typeof sendMessage>[1] = {
        text: emoji,
        sender: currentUser.uid,
        receiverId: contactIdValue,
        timestamp: Date.now(),
        receiverPushToken,
      };
      let senderPushToken = null;
      try {
        senderPushToken = await getUserExpoPushToken(currentUser.uid);
      } catch {}
      outgoingMessage.senderPushToken = senderPushToken;
      outgoingMessage.replyTo = {
        messageId: targetMessage.id,
        senderId: targetMessage.sender,
        snippet: makeReplySnippet(targetMessage.text),
        type: "text",
      };

      try {
        await sendMessage(conversationId, outgoingMessage);
      } catch (error) {
        console.error("Failed to send quick emoji reply:", error);
        Alert.alert("Couldn't send reaction. Please try again.");
      }
    },
    [
      clearTypingStopTimeout,
      closeMessageActionSheet,
      contactIdValue,
      conversationId,
      makeReplySnippet,
      messageActionSheet,
      receiverPushToken,
      syncMyTypingState,
    ],
  );

  const handleReplyFromActionSheet = useCallback(() => {
    if (!messageActionSheet) return;
    closeMessageActionSheet();
    handleReplyToMessage(messageActionSheet.message);
  }, [closeMessageActionSheet, handleReplyToMessage, messageActionSheet]);

  const handleEditFromActionSheet = useCallback(() => {
    if (!messageActionSheet || !messageActionSheet.isMe) return;
    closeMessageActionSheet();
    handleEdit(messageActionSheet.message.id, messageActionSheet.message.text);
  }, [closeMessageActionSheet, handleEdit, messageActionSheet]);

  const handleMessageLongPress = useCallback(
    (message: MessageDoc, isMe: boolean) => {
      setMessageActionSheet({ isMe, message });
    },
    [],
  );

  const handleEditSave = async () => {
    if (editingId && conversationId) {
      await editMessage(conversationId, editingId, editingText);
    }
    setEditingId(null);
    setEditingText("");
  };

  const jumpToOriginalMessage = useCallback(
    (messageId: string) => {
      const targetIndex = messages.findIndex((msg) => msg.id === messageId);
      if (targetIndex < 0) {
        Alert.alert("Original message unavailable");
        return;
      }

      flatListRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
        viewPosition: 0.5,
      });

      clearHighlightTimeout();
      setHighlightedMessageId(messageId);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId((current) =>
          current === messageId ? null : current,
        );
      }, MESSAGE_HIGHLIGHT_MS);
    },
    [clearHighlightTimeout, messages],
  );

  const handleSend = async () => {
    Keyboard.dismiss();
    const messageText = input.trim();
    if (!conversationId || messageText.length === 0) return;
    try {
      clearTypingStopTimeout();
      void syncMyTypingState(false);
      const currentUser = getAuth().currentUser;
      // Get sender's push token (if not already stored)
      let senderPushToken = null;
      try {
        if (currentUser?.uid) {
          senderPushToken = await getUserExpoPushToken(currentUser.uid);
        }
      } catch {}
      const outgoingMessage: Parameters<typeof sendMessage>[1] = {
        text: messageText,
        sender: currentUser ? currentUser.uid : "",
        receiverId: contactIdValue,
        timestamp: Date.now(),
        receiverPushToken,
        senderPushToken,
      };
      if (replyingTo) {
        outgoingMessage.replyTo = replyingTo;
      }

      await sendMessage(conversationId, outgoingMessage);
      setInput("");
      setReplyingTo(null);
    } catch (err) {
      console.error("Error sending message to Firestore:", err);
      const msg =
        typeof err === "object" && err && "message" in err
          ? (err as any).message
          : String(err);
      alert("Failed to send message: " + msg);
    }
  };

  const renderItem = ({ item }: { item: MessageDoc }) => {
    const isMe = item.sender === getAuth().currentUser?.uid;
    const isHighlighted = highlightedMessageId === item.id;
    const replyTo = item.replyTo;
    return (
      <TouchableOpacity
        onLongPress={() => handleMessageLongPress(item, isMe)}
        style={[
          styles.bubble,
          isMe ? styles.bubbleMe : styles.bubbleOther,
          isHighlighted ? styles.bubbleHighlighted : null,
        ]}
        activeOpacity={0.7}
      >
        {editingId === item.id ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TextInput
              value={editingText}
              onChangeText={setEditingText}
              style={[
                styles.input,
                { flex: 1, marginRight: 8, backgroundColor: "#fff" },
              ]}
              autoFocus
            />
            <TouchableOpacity onPress={handleEditSave} style={styles.saveBtn}>
              <Text style={{ color: Colors.light.bubbleMe, fontWeight: "600" }}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bubbleContent}>
            {replyTo ? (
              <TouchableOpacity
                onPress={() => jumpToOriginalMessage(replyTo.messageId)}
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
                  {replyTo.deleted ?
                    "Original message unavailable" :
                    replyTo.snippet}
                </Text>
              </TouchableOpacity>
            ) : null}
            <Text
              style={[
                styles.bubbleText,
                isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
              ]}
            >
              {item.text}
            </Text>
            {item.edited && <Text style={styles.edited}>(edited)</Text>}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { flex: 1 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <View style={[styles.container, { flex: 1 }]}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            flatListRef.current?.scrollToOffset({
              offset: averageItemLength * index,
              animated: true,
            });
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.5,
              });
            }, 100);
          }}
          ListFooterComponent={
            isOtherPartyTyping ? (
              <View style={styles.typingBubbleContainer}>
                <View
                  style={[styles.bubble, styles.bubbleOther, styles.typingBubble]}
                >
                  <TypingIndicatorDots />
                </View>
              </View>
            ) : null
          }
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
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
              <TouchableOpacity
                onPress={() => setReplyingTo(null)}
                style={styles.replyComposerClose}
              >
                <Text style={styles.replyComposerCloseText}>x</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.inputBar}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={input}
              onChangeText={handleInputChange}
              placeholder="iMessage"
              placeholderTextColor="#aaa"
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                Send
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <Modal
        visible={Boolean(messageActionSheet)}
        transparent
        animationType="fade"
        onRequestClose={closeMessageActionSheet}
      >
        <View style={styles.messageActionSheetOverlay}>
          <Pressable
            style={styles.messageActionSheetBackdrop}
            onPress={closeMessageActionSheet}
          />
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
                  onPress={() => void handleQuickEmojiReply(emoji)}
                >
                  <Text style={styles.messageActionSheetEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.messageActionSheetRow}
              onPress={handleReplyFromActionSheet}
            >
              <Text style={styles.messageActionSheetRowText}>Reply</Text>
            </TouchableOpacity>
            {messageActionSheet?.isMe ? (
              <TouchableOpacity
                style={styles.messageActionSheetRow}
                onPress={handleEditFromActionSheet}
              >
                <Text style={styles.messageActionSheetRowText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.messageActionSheetRow}
              onPress={closeMessageActionSheet}
            >
              <Text style={styles.messageActionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default MessagingScreen;
