import { getAuth } from "@react-native-firebase/auth";
import * as Clipboard from "expo-clipboard";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
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
  uploadConversationImage,
} from "../../../api";

import {
  ConversationDoc,
  MessageImage,
  MessageDoc,
  ReplyReference,
} from "../../types/firestore";

import { smartShade } from "@/app/utils/colorUtils";
import { Colors } from "../../../constants/theme";
import styles from "./styles";

const TYPING_PAUSE_MS = 1500;
const TYPING_STALE_MS = 5000;
const MESSAGE_HIGHLIGHT_MS = 1800;
const MY_BUBBLE_COLOR = Colors.light.bubbleMe;
const MY_BUBBLE_GRADIENT_COLORS = [
  smartShade(MY_BUBBLE_COLOR, -5),
  MY_BUBBLE_COLOR,
] as const;
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

type ReplyTarget = Required<
  Pick<ReplyReference, "messageId" | "senderId" | "snippet">
> & {
  type: "text";
};

type PendingImage = {
  source: "picker" | "paste";
  previewUri: string;
  localUri?: string;
  dataUri?: string;
  width?: number;
  height?: number;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

type MessageActionSheetState = {
  isMe: boolean;
  canEdit: boolean;
  message: MessageDoc;
};

const MessagingScreen = () => {
  const navigation = useNavigation();
  const { contactId, contactName } = useLocalSearchParams();
  useEffect(() => {
    const parsedContactName =
      typeof contactName === "string" ? contactName.trim() : "";
    navigation.setOptions({
      title: parsedContactName || "Messages",
      headerBackTitle: "Contacts",
    });
  }, [contactName, navigation]);
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
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [viewerImageUri, setViewerImageUri] = useState<string | null>(null);
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
        setPendingImage(null);
        setViewerImageUri(null);
        setIsSendingImage(false);
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

  const makeReplySnippetFromMessage = useCallback(
    (message: MessageDoc) => {
      const text = typeof message.text === "string" ? message.text : "";
      if (text.trim().length > 0) {
        return makeReplySnippet(text);
      }
      if (message.image?.url) {
        return "Photo";
      }
      return "Message";
    },
    [makeReplySnippet],
  );

  const pickImageFromLibrary = useCallback(async () => {
    try {
      const mediaPermission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPermission.granted) {
        Alert.alert(
          "Photos permission needed",
          "Please allow photo access to send images.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const inferredMimeType =
        asset.mimeType ??
        (asset.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
      setPendingImage({
        source: "picker",
        previewUri: asset.uri,
        localUri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName ?? undefined,
        mimeType: inferredMimeType,
        sizeBytes: asset.fileSize ?? undefined,
      });
    } catch (error) {
      console.error("Failed to pick image:", error);
      Alert.alert("Couldn't open your photo library.");
    }
  }, []);

  const pasteImageFromClipboard = useCallback(async () => {
    try {
      const hasImage = await Clipboard.hasImageAsync();
      if (!hasImage) {
        Alert.alert("Clipboard has no image", "Copy an image first, then paste.");
        return;
      }
      const clipboardImage = await Clipboard.getImageAsync({ format: "png" });
      if (!clipboardImage?.data) {
        Alert.alert("Clipboard image unavailable");
        return;
      }
      const isJpeg = clipboardImage.data.startsWith("data:image/jpeg");
      setPendingImage({
        source: "paste",
        previewUri: clipboardImage.data,
        dataUri: clipboardImage.data,
        width: clipboardImage.size.width,
        height: clipboardImage.size.height,
        mimeType: isJpeg ? "image/jpeg" : "image/png",
      });
    } catch (error) {
      console.error("Failed to paste image:", error);
      Alert.alert("Couldn't paste image from clipboard.");
    }
  }, []);

  const openImageAttachmentActions = useCallback(async () => {
    let canPasteImage = false;
    try {
      canPasteImage = await Clipboard.hasImageAsync();
    } catch {
      canPasteImage = false;
    }

    Alert.alert("Add image", undefined, [
      {
        text: "Choose Photo",
        onPress: () => {
          void pickImageFromLibrary();
        },
      },
      ...(canPasteImage
        ? [
            {
              text: "Paste Image",
              onPress: () => {
                void pasteImageFromClipboard();
              },
            },
          ]
        : []),
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }, [pasteImageFromClipboard, pickImageFromLibrary]);

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
        snippet: makeReplySnippetFromMessage(message),
        type: "text",
      });
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [makeReplySnippetFromMessage],
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
        snippet: makeReplySnippetFromMessage(targetMessage),
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
      makeReplySnippetFromMessage,
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
    if (
      !messageActionSheet ||
      !messageActionSheet.isMe ||
      !messageActionSheet.canEdit
    ) {
      return;
    }
    closeMessageActionSheet();
    handleEdit(
      messageActionSheet.message.id,
      messageActionSheet.message.text ?? "",
    );
  }, [closeMessageActionSheet, handleEdit, messageActionSheet]);

  const handleMessageLongPress = useCallback(
    (message: MessageDoc, isMe: boolean) => {
      setMessageActionSheet({
        isMe,
        canEdit: isMe && typeof message.text === "string" && message.text.trim().length > 0,
        message,
      });
    },
    [],
  );

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setEditingText("");
  }, []);

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
    if (
      !conversationId ||
      (messageText.length === 0 && !pendingImage) ||
      isSendingImage
    ) {
      return;
    }
    try {
      clearTypingStopTimeout();
      void syncMyTypingState(false);
      const currentUser = getAuth().currentUser;
      if (!currentUser?.uid) return;

      let uploadedImage: MessageImage | undefined;
      if (pendingImage) {
        setIsSendingImage(true);
        uploadedImage = await uploadConversationImage({
          conversationId,
          senderId: currentUser.uid,
          localUri: pendingImage.localUri,
          dataUri: pendingImage.source === "paste" ? pendingImage.dataUri : undefined,
          fileName: pendingImage.fileName,
          mimeType: pendingImage.mimeType,
          width: pendingImage.width,
          height: pendingImage.height,
          sizeBytes: pendingImage.sizeBytes,
        });
      }

      // Get sender's push token (if not already stored)
      let senderPushToken = null;
      try {
        senderPushToken = await getUserExpoPushToken(currentUser.uid);
      } catch {}
      const outgoingMessage: Parameters<typeof sendMessage>[1] = {
        text: messageText.length > 0 ? messageText : undefined,
        image: uploadedImage,
        kind: uploadedImage ? (messageText.length > 0 ? "mixed" : "image") : "text",
        sender: currentUser.uid,
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
      setPendingImage(null);
    } catch (err) {
      console.error("Error sending message to Firestore:", err);
      const code =
        typeof err === "object" && err && "code" in err
          ? String((err as { code?: unknown }).code ?? "")
          : "";
      const msg =
        typeof err === "object" && err && "message" in err
          ? (err as any).message
          : String(err);
      Alert.alert(
        "Failed to send message",
        code ? `${msg}\n\nCode: ${code}` : msg,
      );
    } finally {
      setIsSendingImage(false);
    }
  };

  const renderItem = ({ item }: { item: MessageDoc }) => {
    const isMe = item.sender === getAuth().currentUser?.uid;
    const isHighlighted = highlightedMessageId === item.id;
    const replyTo = item.replyTo;
    const messageText = typeof item.text === "string" ? item.text : "";
    const hasText = messageText.trim().length > 0;
    const messageImage = item.image;
    const hasImage = Boolean(messageImage?.url);
    const imageAspectRatio =
      messageImage?.width && messageImage?.height && messageImage.height > 0
        ? messageImage.width / messageImage.height
        : 1;
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
        {isMe ? (
          <LinearGradient
            colors={MY_BUBBLE_GRADIENT_COLORS}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.bubbleMeGradient}
            pointerEvents="none"
          />
        ) : null}
        {editingId === item.id ? (
          <View style={styles.editContainer}>
            <TextInput
              value={editingText}
              onChangeText={setEditingText}
              style={styles.editInput}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
              autoFocus
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                onPress={handleEditCancel}
                style={styles.editCancelBtn}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEditSave} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
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
                    isMe
                      ? styles.replyQuoteLabelMe
                      : styles.replyQuoteLabelOther,
                  ]}
                >
                  Replying to{" "}
                  {replyTo.senderId === currentUserId ? "You" : "Them"}
                </Text>
                <Text
                  style={[
                    styles.replyQuoteText,
                    isMe ? styles.replyQuoteTextMe : styles.replyQuoteTextOther,
                  ]}
                  numberOfLines={2}
                >
                  {replyTo.deleted
                    ? "Original message unavailable"
                    : replyTo.snippet}
                </Text>
              </TouchableOpacity>
            ) : null}
            {hasText ? (
              <Text
                style={[
                  styles.bubbleText,
                  isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
                ]}
              >
                {messageText}
              </Text>
            ) : null}
            {hasImage ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setViewerImageUri(messageImage?.url ?? null)}
                style={hasText ? styles.messageImageWrapWithText : null}
              >
                <ExpoImage
                  source={{ uri: messageImage?.url }}
                  style={[styles.messageImage, { aspectRatio: imageAspectRatio }]}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ) : null}
            {item.edited && hasText ? <Text style={styles.edited}>(edited)</Text> : null}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const canSend =
    (input.trim().length > 0 || Boolean(pendingImage)) && !isSendingImage;

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
                  style={[
                    styles.bubble,
                    styles.bubbleOther,
                    styles.typingBubble,
                  ]}
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
                  Replying to{" "}
                  {replyingTo.senderId === currentUserId ? "You" : "Them"}
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
          {pendingImage ? (
            <View style={styles.pendingImageComposer}>
              <TouchableOpacity
                onPress={() => setViewerImageUri(pendingImage.previewUri)}
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
              <TouchableOpacity
                onPress={() => setPendingImage(null)}
                style={styles.pendingImageRemoveBtn}
              >
                <Text style={styles.pendingImageRemoveText}>x</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.inputBar}>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() => {
                void openImageAttachmentActions();
              }}
            >
              <Text style={styles.attachBtnText}>+</Text>
            </TouchableOpacity>
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
            <TouchableOpacity
              onPress={handleSend}
              style={[styles.sendBtn, !canSend ? styles.sendBtnDisabled : null]}
              disabled={!canSend}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                {isSendingImage ? "Sending..." : "Send"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <Modal
        visible={Boolean(viewerImageUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerImageUri(null)}
      >
        <Pressable
          style={styles.imageViewerBackdrop}
          onPress={() => setViewerImageUri(null)}
        >
          {viewerImageUri ? (
            <ExpoImage
              source={{ uri: viewerImageUri }}
              style={styles.imageViewerImage}
              contentFit="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
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
                  <Text style={styles.messageActionSheetEmojiText}>
                    {emoji}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.messageActionSheetRow}
              onPress={handleReplyFromActionSheet}
            >
              <Text style={styles.messageActionSheetRowText}>Reply</Text>
            </TouchableOpacity>
            {messageActionSheet?.isMe && messageActionSheet.canEdit ? (
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
