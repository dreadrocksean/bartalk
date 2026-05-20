import { getAuth } from "@react-native-firebase/auth";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { TypingIndicatorDots } from "../../../components/typing-indicator-dots";

import type { MessagesPageCursor } from "../../../api";
import {
  deleteMessage,
  editMessage,
  fetchOlderMessagesPage,
  getOrCreateConversation,
  getUserExpoPushToken,
  listenForConversation,
  listenForRecentMessages,
  markConversationRead,
  sendMessage,
  setConversationTyping,
  setMessageReaction,
  uploadConversationImage,
} from "../../../api";

import {
  ConversationDoc,
  MessageDoc,
  MessageImage,
} from "../../types/firestore";
import type {
  MessageActionSheetState,
  MessageListItem,
  PendingImage,
  ReplyTarget,
  SwipeAutoCloseTimeoutsMap,
  TopLoadAnchor,
} from "./types";

import {
  AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
  LOAD_OLDER_THROTTLE_MS,
  LOAD_OLDER_TOP_THRESHOLD_PX,
  MESSAGE_HIGHLIGHT_MS,
  MESSAGES_PAGE_SIZE,
  SWIPE_AUTO_CLOSE_MS,
  TYPING_PAUSE_MS,
  TYPING_STALE_MS,
} from "./constants";
import { DayHeaderRow } from "./components/DayHeaderRow";
import { ImageViewerModal } from "./components/ImageViewerModal";
import { MessageActionSheetModal } from "./components/MessageActionSheetModal";
import { MessageComposer } from "./components/MessageComposer";
import { MessageRow } from "./components/MessageRow";
import styles from "./styles";
import {
  buildMessageListItems,
  formatMessageTime,
  mergeMessagesChronologically,
} from "./utils";

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
  const [recentMessages, setRecentMessages] = useState<MessageDoc[]>([]);
  const [olderMessages, setOlderMessages] = useState<MessageDoc[]>([]);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [isOtherPartyTyping, setIsOtherPartyTyping] = useState(false);
  const flatListRef = useRef<FlatList<MessageListItem>>(null);
  const shouldAutoScrollToLatestRef = useRef(true);
  const forceAutoScrollToLatestRef = useRef(true);
  const isInitialAutoPinActiveRef = useRef(true);
  const hasUserScrolledRef = useRef(false);
  const canTriggerTopLoadRef = useRef(true);
  const topLoadAnchorRef = useRef<TopLoadAnchor | null>(null);
  const lastScrollOffsetYRef = useRef(0);
  const oldestMessageCursorRef = useRef<MessagesPageCursor | null>(null);
  const isLoadingOlderMessagesRef = useRef(false);
  const lastOlderLoadAttemptAtRef = useRef(0);
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
  const swipeAutoCloseTimeoutsRef = useRef<SwipeAutoCloseTimeoutsMap>(
    new Map(),
  );

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

  const clearSwipeAutoCloseTimeout = useCallback((messageId: string) => {
    const timeoutHandle = swipeAutoCloseTimeoutsRef.current.get(messageId);
    if (!timeoutHandle) {
      return;
    }
    clearTimeout(timeoutHandle);
    swipeAutoCloseTimeoutsRef.current.delete(messageId);
  }, []);

  const clearAllSwipeAutoCloseTimeouts = useCallback(() => {
    swipeAutoCloseTimeoutsRef.current.forEach((timeoutHandle) => {
      clearTimeout(timeoutHandle);
    });
    swipeAutoCloseTimeoutsRef.current.clear();
  }, []);

  const scheduleSwipeAutoClose = useCallback(
    (messageId: string, swipeable: { close: () => void }) => {
      clearSwipeAutoCloseTimeout(messageId);
      const timeoutHandle = setTimeout(() => {
        swipeable.close();
        clearSwipeAutoCloseTimeout(messageId);
      }, SWIPE_AUTO_CLOSE_MS);
      swipeAutoCloseTimeoutsRef.current.set(messageId, timeoutHandle);
    },
    [clearSwipeAutoCloseTimeout],
  );

  const messages = useMemo(
    () => mergeMessagesChronologically(olderMessages, recentMessages),
    [olderMessages, recentMessages],
  );

  const scrollToLatestIfNeeded = useCallback((animated: boolean) => {
    const shouldAutoScroll =
      forceAutoScrollToLatestRef.current || shouldAutoScrollToLatestRef.current;
    if (!shouldAutoScroll) {
      return;
    }
    flatListRef.current?.scrollToEnd({ animated });
    forceAutoScrollToLatestRef.current = false;
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (
      !conversationId ||
      !hasOlderMessages ||
      isLoadingOlderMessagesRef.current
    ) {
      return;
    }
    const cursor = oldestMessageCursorRef.current;
    if (!cursor) {
      setHasOlderMessages(false);
      return;
    }

    isLoadingOlderMessagesRef.current = true;
    setIsLoadingOlderMessages(true);

    try {
      const page = await fetchOlderMessagesPage({
        conversationId,
        pageSize: MESSAGES_PAGE_SIZE,
        oldestCursor: cursor,
      });
      oldestMessageCursorRef.current = page.oldestCursor;
      setHasOlderMessages(page.hasMore);
      if (page.messages.length > 0) {
        setOlderMessages((current) =>
          mergeMessagesChronologically(current, page.messages as MessageDoc[]),
        );
      } else {
        topLoadAnchorRef.current = null;
      }
    } catch (error) {
      console.error("Failed to load older messages:", error);
      topLoadAnchorRef.current = null;
    } finally {
      isLoadingOlderMessagesRef.current = false;
      setIsLoadingOlderMessages(false);
    }
  }, [conversationId, hasOlderMessages]);

  const handleMessagesScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentOffsetY = nativeEvent.contentOffset.y;
      const isScrollingTowardTop =
        currentOffsetY < lastScrollOffsetYRef.current - 0.5;
      lastScrollOffsetYRef.current = currentOffsetY;

      const distanceFromBottom =
        nativeEvent.contentSize.height -
        (currentOffsetY + nativeEvent.layoutMeasurement.height);
      shouldAutoScrollToLatestRef.current =
        distanceFromBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;

      if (!hasUserScrolledRef.current && currentOffsetY > 2) {
        hasUserScrolledRef.current = true;
        isInitialAutoPinActiveRef.current = false;
        shouldAutoScrollToLatestRef.current = false;
        forceAutoScrollToLatestRef.current = false;
      }

      if (!hasUserScrolledRef.current) {
        return;
      }

      if (
        isScrollingTowardTop &&
        currentOffsetY <= LOAD_OLDER_TOP_THRESHOLD_PX &&
        canTriggerTopLoadRef.current
      ) {
        const now = Date.now();
        if (now - lastOlderLoadAttemptAtRef.current >= LOAD_OLDER_THROTTLE_MS) {
          lastOlderLoadAttemptAtRef.current = now;
          canTriggerTopLoadRef.current = false;
          const stopOffset = Math.max(0, currentOffsetY);
          topLoadAnchorRef.current = {
            offsetY: stopOffset,
            contentHeight: nativeEvent.contentSize.height,
          };
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToOffset({
              offset: stopOffset,
              animated: false,
            });
          });
          void loadOlderMessages();
        }
      }
    },
    [loadOlderMessages],
  );

  const handleContentSizeChange = useCallback(
    (_width: number, contentHeight: number) => {
      const topLoadAnchor = topLoadAnchorRef.current;
      if (topLoadAnchor) {
        const deltaHeight = contentHeight - topLoadAnchor.contentHeight;
        if (Math.abs(deltaHeight) > 0.5) {
          const anchoredOffset = Math.max(
            0,
            topLoadAnchor.offsetY + deltaHeight,
          );
          topLoadAnchor.offsetY = anchoredOffset;
          topLoadAnchor.contentHeight = contentHeight;
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToOffset({
              offset: anchoredOffset,
              animated: false,
            });
          });
        } else {
          topLoadAnchor.contentHeight = contentHeight;
        }
        if (!isLoadingOlderMessagesRef.current) {
          topLoadAnchorRef.current = null;
        }
        return;
      }

      if (isInitialAutoPinActiveRef.current && !hasUserScrolledRef.current) {
        forceAutoScrollToLatestRef.current = true;
        flatListRef.current?.scrollToEnd({ animated: false });
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        });
        return;
      }
      if (hasUserScrolledRef.current && !forceAutoScrollToLatestRef.current) {
        return;
      }
      scrollToLatestIfNeeded(true);
    },
    [scrollToLatestIfNeeded],
  );

  const handleMessagesScrollBeginDrag = useCallback(() => {
    hasUserScrolledRef.current = true;
    isInitialAutoPinActiveRef.current = false;
    shouldAutoScrollToLatestRef.current = false;
    forceAutoScrollToLatestRef.current = false;
    canTriggerTopLoadRef.current = true;
    topLoadAnchorRef.current = null;
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
      isInitialAutoPinActiveRef.current = true;
      hasUserScrolledRef.current = false;
      canTriggerTopLoadRef.current = true;
      clearAllSwipeAutoCloseTimeouts();
      topLoadAnchorRef.current = null;
      lastScrollOffsetYRef.current = 0;
      oldestMessageCursorRef.current = null;
      isLoadingOlderMessagesRef.current = false;
      lastOlderLoadAttemptAtRef.current = 0;
      setRecentMessages([]);
      setOlderMessages([]);
      setHasOlderMessages(false);
      setIsLoadingOlderMessages(false);
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

        unsubscribeMessages = listenForRecentMessages(
          convoRef.id,
          MESSAGES_PAGE_SIZE,
          async (page) => {
            if (!isActive) return;
            const recentPageMessages = (page.messages as MessageDoc[]).sort(
              (a, b) => a.timestamp - b.timestamp,
            );

            setRecentMessages((previousRecent) => {
              const incomingIds = new Set(
                recentPageMessages.map((message) => message.id),
              );
              const evictedMessages = previousRecent.filter(
                (message) => !incomingIds.has(message.id),
              );
              if (evictedMessages.length > 0) {
                setOlderMessages((previousOlder) =>
                  mergeMessagesChronologically(previousOlder, evictedMessages),
                );
              }
              return recentPageMessages;
            });

            oldestMessageCursorRef.current = page.oldestCursor;
            setHasOlderMessages(page.hasMore);

            if (recentPageMessages.length > 0) {
              const lastMsg = recentPageMessages[recentPageMessages.length - 1];
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
            requestAnimationFrame(() => {
              if (
                hasUserScrolledRef.current &&
                !forceAutoScrollToLatestRef.current
              ) {
                return;
              }
              scrollToLatestIfNeeded(true);
            });
          },
        );
      })();
      return () => {
        isActive = false;
        clearTypingStopTimeout();
        clearRemoteTypingExpiryTimeout();
        clearHighlightTimeout();
        clearAllSwipeAutoCloseTimeouts();
        setIsOtherPartyTyping(false);
        setReplyingTo(null);
        setHighlightedMessageId(null);
        setPendingImage(null);
        setViewerImageUri(null);
        setIsSendingImage(false);
        setMessageActionSheet(null);
        setConversationId(null);
        setRecentMessages([]);
        setOlderMessages([]);
        setHasOlderMessages(false);
        setIsLoadingOlderMessages(false);
        shouldAutoScrollToLatestRef.current = true;
        forceAutoScrollToLatestRef.current = true;
        isInitialAutoPinActiveRef.current = true;
        hasUserScrolledRef.current = false;
        canTriggerTopLoadRef.current = true;
        topLoadAnchorRef.current = null;
        lastScrollOffsetYRef.current = 0;
        oldestMessageCursorRef.current = null;
        isLoadingOlderMessagesRef.current = false;
        lastOlderLoadAttemptAtRef.current = 0;
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
      clearAllSwipeAutoCloseTimeouts,
      clearRemoteTypingExpiryTimeout,
      clearHighlightTimeout,
      clearTypingStopTimeout,
      contactIdValue,
      currentUserId,
      scrollToLatestIfNeeded,
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
        Alert.alert(
          "Clipboard has no image",
          "Copy an image first, then paste.",
        );
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
      const existingReaction =
        targetMessage.reactions?.[currentUser.uid] ?? null;
      const nextReaction = existingReaction === emoji ? null : emoji;

      try {
        await setMessageReaction({
          conversationId,
          messageId: targetMessage.id,
          userId: currentUser.uid,
          emoji: nextReaction,
        });
      } catch (error) {
        console.error("Failed to set reaction:", error);
        Alert.alert("Couldn't send reaction. Please try again.");
      }
    },
    [
      clearTypingStopTimeout,
      closeMessageActionSheet,
      conversationId,
      messageActionSheet,
      syncMyTypingState,
    ],
  );

  const handleReplyFromActionSheet = useCallback(() => {
    if (!messageActionSheet) return;
    closeMessageActionSheet();
    handleReplyToMessage(messageActionSheet.message);
  }, [closeMessageActionSheet, handleReplyToMessage, messageActionSheet]);

  const handleCopyFromActionSheet = useCallback(async () => {
    if (!messageActionSheet) return;

    const targetMessage = messageActionSheet.message;
    const textValue =
      typeof targetMessage.text === "string" ? targetMessage.text : "";
    const valueToCopy =
      textValue.trim().length > 0
        ? textValue
        : (targetMessage.image?.url ?? "");

    closeMessageActionSheet();

    if (!valueToCopy) {
      Alert.alert("Nothing to copy");
      return;
    }

    try {
      await Clipboard.setStringAsync(valueToCopy);
    } catch (error) {
      console.error("Failed to copy message:", error);
      Alert.alert("Couldn't copy message. Please try again.");
    }
  }, [closeMessageActionSheet, messageActionSheet]);

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

  const handleDeleteFromActionSheet = useCallback(() => {
    if (!conversationId || !messageActionSheet || !messageActionSheet.isMe) {
      return;
    }

    const targetMessageId = messageActionSheet.message.id;
    closeMessageActionSheet();

    Alert.alert("Delete message?", "This action can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteMessage(conversationId, targetMessageId);
              setRecentMessages((current) =>
                current.filter((message) => message.id !== targetMessageId),
              );
              setOlderMessages((current) =>
                current.filter((message) => message.id !== targetMessageId),
              );
              if (editingId === targetMessageId) {
                setEditingId(null);
                setEditingText("");
              }
              setReplyingTo((current) =>
                current?.messageId === targetMessageId ? null : current,
              );
            } catch (error) {
              console.error("Failed to delete message:", error);
              Alert.alert("Couldn't delete message. Please try again.");
            }
          })();
        },
      },
    ]);
  }, [closeMessageActionSheet, conversationId, editingId, messageActionSheet]);

  const handleMessageLongPress = useCallback(
    (message: MessageDoc, isMe: boolean) => {
      setMessageActionSheet({
        isMe,
        canEdit:
          isMe &&
          typeof message.text === "string" &&
          message.text.trim().length > 0,
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
      const messageIndex = messages.findIndex((msg) => msg.id === messageId);
      if (messageIndex < 0) {
        Alert.alert("Original message unavailable");
        return;
      }

      let dayHeaderCount = 0;
      let lastDayKey: string | null = null;
      for (let idx = 0; idx <= messageIndex; idx += 1) {
        const messageDate = new Date(messages[idx].timestamp);
        const dayKey = `${messageDate.getFullYear()}-${messageDate.getMonth()}-${messageDate.getDate()}`;
        if (dayKey !== lastDayKey) {
          dayHeaderCount += 1;
          lastDayKey = dayKey;
        }
      }
      const targetIndex = messageIndex + dayHeaderCount;

      shouldAutoScrollToLatestRef.current = false;
      forceAutoScrollToLatestRef.current = false;
      isInitialAutoPinActiveRef.current = false;
      hasUserScrolledRef.current = true;
      canTriggerTopLoadRef.current = false;
      topLoadAnchorRef.current = null;
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
      try {
        await currentUser.getIdToken();
      } catch (tokenError) {
        console.warn("Unable to refresh auth token before upload:", tokenError);
      }

      let uploadedImage: MessageImage | undefined;
      if (pendingImage) {
        setIsSendingImage(true);
        uploadedImage = await uploadConversationImage({
          conversationId,
          senderId: currentUser.uid,
          localUri: pendingImage.localUri,
          dataUri:
            pendingImage.source === "paste" ? pendingImage.dataUri : undefined,
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
        kind: uploadedImage
          ? messageText.length > 0
            ? "mixed"
            : "image"
          : "text",
        sender: currentUser.uid,
        receiverId: contactIdValue,
        timestamp: Date.now(),
        receiverPushToken,
        senderPushToken,
      };
      if (replyingTo) {
        outgoingMessage.replyTo = replyingTo;
      }

      forceAutoScrollToLatestRef.current = true;
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

  const messageListItems = useMemo(() => buildMessageListItems(messages), [messages]);

  const renderItem = ({ item }: { item: MessageListItem }) => {
    if (item.type === "dayHeader") {
      return <DayHeaderRow label={item.label} />;
    }

    return (
      <MessageRow
        message={item.message}
        currentUserId={currentUserId}
        highlightedMessageId={highlightedMessageId}
        editingId={editingId}
        editingText={editingText}
        onEditingTextChange={setEditingText}
        onMessageLongPress={handleMessageLongPress}
        onSwipeOpen={scheduleSwipeAutoClose}
        onSwipeClose={clearSwipeAutoCloseTimeout}
        onJumpToOriginalMessage={jumpToOriginalMessage}
        onEditCancel={handleEditCancel}
        onEditSave={handleEditSave}
        onViewerImageUriChange={setViewerImageUri}
        formatMessageTime={formatMessageTime}
      />
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
          data={messageListItems}
          renderItem={renderItem}
          onScroll={handleMessagesScroll}
          onScrollBeginDrag={handleMessagesScrollBeginDrag}
          scrollEventThrottle={16}
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
          ListHeaderComponent={
            isLoadingOlderMessages ? (
              <View style={styles.dayHeaderRow}>
                <Text style={styles.dayHeaderText}>
                  Loading older messages...
                </Text>
              </View>
            ) : null
          }
          onContentSizeChange={handleContentSizeChange}
        />
        <MessageComposer
          currentUserId={currentUserId}
          replyingTo={replyingTo}
          onClearReplyingTo={() => setReplyingTo(null)}
          pendingImage={pendingImage}
          onOpenViewerImage={(uri) => setViewerImageUri(uri)}
          onClearPendingImage={() => setPendingImage(null)}
          inputRef={inputRef}
          input={input}
          onInputChange={handleInputChange}
          onOpenImageAttachmentActions={openImageAttachmentActions}
          onSend={handleSend}
          canSend={canSend}
          isSendingImage={isSendingImage}
        />
      </View>
      <ImageViewerModal
        viewerImageUri={viewerImageUri}
        onClose={() => setViewerImageUri(null)}
      />
      <MessageActionSheetModal
        messageActionSheet={messageActionSheet}
        onClose={closeMessageActionSheet}
        onQuickEmojiReply={handleQuickEmojiReply}
        onReply={handleReplyFromActionSheet}
        onCopy={handleCopyFromActionSheet}
        onEdit={handleEditFromActionSheet}
        onDelete={handleDeleteFromActionSheet}
      />
    </KeyboardAvoidingView>
  );
};

export default MessagingScreen;
