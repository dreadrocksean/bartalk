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
  type ViewToken,
} from "react-native";
import { TypingIndicatorDots } from "../../../components/typing-indicator-dots";
import { useWatchScope } from "../../../hooks/use-watch-scope";

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
  uploadConversationMedia,
} from "../../../api";

import {
  ConversationDoc,
  MessageDoc,
  MessageMedia,
} from "../../types/firestore";
import { saveAllMediaToDevice } from "../../utils/media-download";
import type {
  MediaViewerState,
  MessageActionSheetState,
  MessageListItem,
  PendingMedia,
  ReplyTarget,
  SwipeAutoCloseTimeoutsMap,
} from "./types";

import {
  AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
  MEDIA_SELECTION_LIMIT,
  LOAD_OLDER_THROTTLE_MS,
  LOAD_OLDER_TOP_THRESHOLD_PX,
  MESSAGE_HIGHLIGHT_MS,
  MESSAGES_PAGE_SIZE,
  SWIPE_AUTO_CLOSE_MS,
  TYPING_PAUSE_MS,
  TYPING_STALE_MS,
} from "./constants";
import { DayHeaderRow } from "./components/DayHeaderRow";
import { MediaViewerModal } from "./components/MediaViewerModal";
import { MessageActionSheetModal } from "./components/MessageActionSheetModal";
import { MessageComposer } from "./components/MessageComposer";
import { MessageRow } from "./components/MessageRow";
import { MiniMapDock } from "./components/MiniMapDock";
import styles from "./styles";
import {
  buildMessageListItems,
  describeMessageMedia,
  formatMessageTime,
  getMessageMedia,
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
  const contactNameValue =
    typeof contactName === "string" ? contactName.trim() : "";
  const currentUserId = getAuth().currentUser?.uid ?? null;

  // "preserve" continues a watch that is already open for this person — the
  // case where you tapped their pin on the map to come here. It never starts
  // one, so opening a chat can't reveal a position without them being told.
  useWatchScope(
    "preserve",
    useMemo(
      () => [
        {
          trackeeId: contactIdValue,
          trackeeName: contactNameValue || "Trackee",
        },
      ],
      [contactIdValue, contactNameValue],
    ),
  );
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
  const lastScrollOffsetYRef = useRef(0);
  const oldestMessageCursorRef = useRef<MessagesPageCursor | null>(null);
  const isLoadingOlderMessagesRef = useRef(false);
  const lastOlderLoadAttemptAtRef = useRef(0);
  const shouldLogOlderFetchPostStateRef = useRef(false);
  const topVisibleMessageDebugRef = useRef<{
    id: string;
    snippet: string;
    timestamp: number;
    sender: string;
  } | null>(null);
  const lastContentHeightRef = useRef(0);
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
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState | null>(null);
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
      }
    } catch (error) {
      console.error("Failed to load older messages:", error);
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
      lastContentHeightRef.current = nativeEvent.contentSize.height;
      shouldAutoScrollToLatestRef.current =
        distanceFromBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;

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
          const topVisibleMessageDebug = topVisibleMessageDebugRef.current;
          console.log("[OlderPageFetchTopMessage]", {
            messageId: topVisibleMessageDebug?.id ?? null,
            sender: topVisibleMessageDebug?.sender ?? null,
            snippet: topVisibleMessageDebug?.snippet ?? null,
            timestamp: topVisibleMessageDebug?.timestamp ?? null,
            timestampIso:
              typeof topVisibleMessageDebug?.timestamp === "number"
                ? new Date(topVisibleMessageDebug.timestamp).toISOString()
                : null,
            offsetY: Math.max(0, currentOffsetY),
            contentHeight: nativeEvent.contentSize.height,
          });
          shouldLogOlderFetchPostStateRef.current = true;
          void loadOlderMessages();
        }
      }
    },
    [loadOlderMessages],
  );

  const handleContentSizeChange = useCallback(
    () => {
      if (isInitialAutoPinActiveRef.current && !hasUserScrolledRef.current) {
        forceAutoScrollToLatestRef.current = true;
        flatListRef.current?.scrollToEnd({ animated: true });
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
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
  }, []);

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 100,
  });

  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<MessageListItem>> }) => {
      const firstVisibleMessage = [...viewableItems]
        .filter(
          (token) =>
            token.isViewable === true &&
            token.item?.type === "message" &&
            typeof token.index === "number",
        )
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];

      if (firstVisibleMessage?.item.type === "message") {
        const message = firstVisibleMessage.item.message;
        const textValue =
          typeof message.text === "string" ? message.text.trim() : "";
        const snippet =
          textValue.length > 0
            ? textValue.slice(0, 120)
            : getMessageMedia(message).length > 0
              ? "[media]"
              : "[no-text]";

        topVisibleMessageDebugRef.current = {
          id: message.id,
          sender: message.sender,
          timestamp: message.timestamp,
          snippet,
        };
      } else {
        topVisibleMessageDebugRef.current = null;
      }
    },
  );

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

  useEffect(() => {
    if (isLoadingOlderMessages || !shouldLogOlderFetchPostStateRef.current) {
      return;
    }

    shouldLogOlderFetchPostStateRef.current = false;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const topVisibleMessageDebug = topVisibleMessageDebugRef.current;
        console.log("[OlderPageFetchTopMessageAfter]", {
          messageId: topVisibleMessageDebug?.id ?? null,
          sender: topVisibleMessageDebug?.sender ?? null,
          snippet: topVisibleMessageDebug?.snippet ?? null,
          timestamp: topVisibleMessageDebug?.timestamp ?? null,
          timestampIso:
            typeof topVisibleMessageDebug?.timestamp === "number"
              ? new Date(topVisibleMessageDebug.timestamp).toISOString()
              : null,
          offsetY: Math.max(0, lastScrollOffsetYRef.current),
          contentHeight: lastContentHeightRef.current,
        });
      });
    });
  }, [isLoadingOlderMessages]);

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
      topVisibleMessageDebugRef.current = null;
      shouldLogOlderFetchPostStateRef.current = false;
      lastScrollOffsetYRef.current = 0;
      lastContentHeightRef.current = 0;
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
        setPendingMedia([]);
        setMediaViewer(null);
        setIsSendingMedia(false);
        setUploadProgress(null);
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
        topVisibleMessageDebugRef.current = null;
        shouldLogOlderFetchPostStateRef.current = false;
        lastScrollOffsetYRef.current = 0;
        lastContentHeightRef.current = 0;
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
      const media = getMessageMedia(message);
      if (media.length > 0) {
        return describeMessageMedia(media);
      }
      return "Message";
    },
    [makeReplySnippet],
  );

  const makePendingMediaId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  /**
   * Adds to the tray rather than replacing it, so a second trip to the picker
   * tops up a selection instead of discarding the first one.
   */
  const appendPendingMedia = useCallback((incoming: PendingMedia[]) => {
    if (incoming.length === 0) return;
    setPendingMedia((current) => {
      const room = MEDIA_SELECTION_LIMIT - current.length;
      if (room <= 0) {
        Alert.alert(
          "Attachment limit reached",
          `A message can carry up to ${MEDIA_SELECTION_LIMIT} photos or videos.`,
        );
        return current;
      }
      if (incoming.length > room) {
        Alert.alert(
          "Attachment limit reached",
          `Only the first ${room} of those were added. A message can carry up to ${MEDIA_SELECTION_LIMIT} photos or videos.`,
        );
      }
      return [...current, ...incoming.slice(0, room)];
    });
  }, []);

  const pickMediaFromLibrary = useCallback(async () => {
    try {
      const mediaPermission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPermission.granted) {
        Alert.alert(
          "Photos permission needed",
          "Please allow photo access to send images and videos.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.9,
        allowsMultipleSelection: true,
        selectionLimit: MEDIA_SELECTION_LIMIT,
      });
      if (result.canceled || result.assets.length === 0) return;

      appendPendingMedia(
        result.assets.map((asset) => {
          const isVideo = asset.type === "video";
          const inferredMimeType =
            asset.mimeType ??
            (isVideo
              ? "video/mp4"
              : asset.uri.toLowerCase().endsWith(".png")
                ? "image/png"
                : "image/jpeg");
          return {
            id: makePendingMediaId(),
            source: "picker" as const,
            type: isVideo ? ("video" as const) : ("image" as const),
            previewUri: asset.uri,
            localUri: asset.uri,
            width: asset.width,
            height: asset.height,
            durationMs: asset.duration ?? undefined,
            fileName: asset.fileName ?? undefined,
            mimeType: inferredMimeType,
            sizeBytes: asset.fileSize ?? undefined,
          };
        }),
      );
    } catch (error) {
      console.error("Failed to pick media:", error);
      Alert.alert("Couldn't open your photo library.");
    }
  }, [appendPendingMedia, makePendingMediaId]);

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
      appendPendingMedia([
        {
          id: makePendingMediaId(),
          source: "paste",
          type: "image",
          previewUri: clipboardImage.data,
          dataUri: clipboardImage.data,
          width: clipboardImage.size.width,
          height: clipboardImage.size.height,
          mimeType: isJpeg ? "image/jpeg" : "image/png",
        },
      ]);
    } catch (error) {
      console.error("Failed to paste image:", error);
      Alert.alert("Couldn't paste image from clipboard.");
    }
  }, [appendPendingMedia, makePendingMediaId]);

  const removePendingMedia = useCallback((mediaId: string) => {
    setPendingMedia((current) => current.filter((item) => item.id !== mediaId));
  }, []);

  const previewPendingMedia = useCallback(
    (mediaId: string) => {
      const index = pendingMedia.findIndex((item) => item.id === mediaId);
      if (index < 0) return;
      setMediaViewer({
        index,
        items: pendingMedia.map((item) => ({
          url: item.previewUri,
          storagePath: item.id,
          type: item.type,
          width: item.width,
          height: item.height,
          durationMs: item.durationMs,
          mimeType: item.mimeType,
          fileName: item.fileName,
          sizeBytes: item.sizeBytes,
        })),
      });
    },
    [pendingMedia],
  );

  const openImageAttachmentActions = useCallback(async () => {
    let canPasteImage = false;
    try {
      canPasteImage = await Clipboard.hasImageAsync();
    } catch {
      canPasteImage = false;
    }

    Alert.alert("Add attachment", undefined, [
      {
        text: "Choose Photos or Videos",
        onPress: () => {
          void pickMediaFromLibrary();
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
  }, [pasteImageFromClipboard, pickMediaFromLibrary]);

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
        : (getMessageMedia(targetMessage)[0]?.url ?? "");

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

  const handleSaveMediaFromActionSheet = useCallback(async () => {
    if (!messageActionSheet) return;
    const media = getMessageMedia(messageActionSheet.message);
    closeMessageActionSheet();
    if (media.length === 0) return;

    const { saved, failed, cancelled } = await saveAllMediaToDevice(media);
    if (failed > 0) {
      Alert.alert(
        "Couldn't save everything",
        saved > 0
          ? `${saved} saved, ${failed} failed. Please try again.`
          : "Please try again.",
      );
      return;
    }
    // A save that the user backed out of needs no confirmation, and on iOS the
    // share sheet has already told them it worked.
    void cancelled;
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
      (messageText.length === 0 && pendingMedia.length === 0) ||
      isSendingMedia
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

      // Uploaded one at a time so the progress label means something and so a
      // dozen parallel uploads can't stall the connection.
      const uploadedMedia: MessageMedia[] = [];
      if (pendingMedia.length > 0) {
        setIsSendingMedia(true);
        for (const [index, item] of pendingMedia.entries()) {
          setUploadProgress({ current: index + 1, total: pendingMedia.length });
          uploadedMedia.push(
            await uploadConversationMedia({
              conversationId,
              senderId: currentUser.uid,
              mediaType: item.type,
              localUri: item.localUri,
              dataUri: item.source === "paste" ? item.dataUri : undefined,
              fileName: item.fileName,
              mimeType: item.mimeType,
              width: item.width,
              height: item.height,
              durationMs: item.durationMs,
              sizeBytes: item.sizeBytes,
            }),
          );
        }
      }

      // Get sender's push token (if not already stored)
      let senderPushToken = null;
      try {
        senderPushToken = await getUserExpoPushToken(currentUser.uid);
      } catch {}
      const outgoingMessage: Parameters<typeof sendMessage>[1] = {
        text: messageText.length > 0 ? messageText : undefined,
        media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
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
      setPendingMedia([]);
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
      setIsSendingMedia(false);
      setUploadProgress(null);
    }
  };

  const handleOpenMediaViewer = useCallback(
    (media: MessageMedia[], index: number) => {
      if (media.length === 0) return;
      setMediaViewer({ items: media, index });
    },
    [],
  );

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
        onOpenMediaViewer={handleOpenMediaViewer}
        formatMessageTime={formatMessageTime}
      />
    );
  };

  const canSend =
    (input.trim().length > 0 || pendingMedia.length > 0) && !isSendingMedia;

  const sendingProgressLabel =
    uploadProgress && uploadProgress.total > 1
      ? `${uploadProgress.current} of ${uploadProgress.total}`
      : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { flex: 1 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <View style={[styles.container, { flex: 1 }]}>
        <MiniMapDock
          contactId={contactIdValue}
          contactName={contactNameValue}
        />
        <FlatList
          ref={flatListRef}
          data={messageListItems}
          renderItem={renderItem}
          onScroll={handleMessagesScroll}
          onScrollBeginDrag={handleMessagesScrollBeginDrag}
          scrollEventThrottle={16}
          scrollEnabled={!isLoadingOlderMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onViewableItemsChanged={onViewableItemsChangedRef.current}
          viewabilityConfig={viewabilityConfigRef.current}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
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
          onContentSizeChange={handleContentSizeChange}
        />
        {isLoadingOlderMessages ? (
          <View pointerEvents="none" style={styles.olderMessagesLoadingOverlay}>
            <Text style={styles.dayHeaderText}>Loading older messages...</Text>
          </View>
        ) : null}
        <MessageComposer
          currentUserId={currentUserId}
          replyingTo={replyingTo}
          onClearReplyingTo={() => setReplyingTo(null)}
          pendingMedia={pendingMedia}
          onPreviewPendingMedia={previewPendingMedia}
          onRemovePendingMedia={removePendingMedia}
          onClearPendingMedia={() => setPendingMedia([])}
          inputRef={inputRef}
          input={input}
          onInputChange={handleInputChange}
          onOpenImageAttachmentActions={openImageAttachmentActions}
          onSend={handleSend}
          canSend={canSend}
          isSendingMedia={isSendingMedia}
          sendingProgressLabel={sendingProgressLabel}
        />
      </View>
      <MediaViewerModal
        viewerState={mediaViewer}
        onClose={() => setMediaViewer(null)}
      />
      <MessageActionSheetModal
        messageActionSheet={messageActionSheet}
        onClose={closeMessageActionSheet}
        onQuickEmojiReply={handleQuickEmojiReply}
        onReply={handleReplyFromActionSheet}
        onCopy={handleCopyFromActionSheet}
        onSaveMedia={handleSaveMediaFromActionSheet}
        onEdit={handleEditFromActionSheet}
        onDelete={handleDeleteFromActionSheet}
      />
    </KeyboardAvoidingView>
  );
};

export default MessagingScreen;
