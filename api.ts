// Mark conversation as read for a user
// Create a user profile in Firestore Users collection
import firestore, {
  addDoc,
  collection,
  deleteDoc,
  doc,
  type FirebaseFirestoreTypes,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
} from "@react-native-firebase/firestore";
import { Alert, Platform } from "react-native";
import type {
  MessageImage,
  MessageKind,
  MessageMedia,
  MessageMediaType,
  ReplyReference,
} from "./app/types/firestore";
import { getFirebaseDb, getFirebaseStorage } from "./firebase";

// ***************************//
// -----------Setup-----------//
// ***************************//
export const getDb = () => getFirebaseDb();
export const getStorage = (bucketUrl?: string) => getFirebaseStorage(bucketUrl);

const getConversationsRef = () => collection(getDb(), "conversations");
// ***************************//

/*
// Get a reference to the Realtime Database service
const database = getDatabase(app);
const connectedRef = ref(database, ".info/connected");
onValue(connectedRef, (snapshot) => {
  if (snapshot.val() === true) {
    console.log("Connected to Firebase Realtime Database!");
    // You can update your UI here to reflect the connected state
  } else {
    console.log("Disconnected from Firebase Realtime Database.");
    // You can update your UI here to reflect the disconnected state
  }
}); */

// ***************************//
// -------Conversations-------//
// ***************************//
export const getOrCreateConversation = async (
  userAId: string,
  userBId: string,
) => {
  const conversationsRef = getConversationsRef();
  // Scoped to the caller's own conversations: reading the whole collection
  // would be rejected by the security rules, which only expose a conversation
  // to its participants.
  const q = query(
    conversationsRef,
    where("participants", "array-contains", userAId),
  );
  const snapshot = await getDocs(q);
  const convo = snapshot.docs.find(
    (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const parts = doc.data().participants;
      return (
        Array.isArray(parts) &&
        parts.length === 2 &&
        parts.includes(userAId) &&
        parts.includes(userBId)
      );
    },
  );
  if (convo) return convo.ref;
  // Create new conversation with userId's
  const newConvo = await addDoc(conversationsRef, {
    participants: [userAId, userBId],
    createdAt: Date.now(),
    lastMessage: null,
  });
  return newConvo;
};

export const markConversationRead = async ({
  conversationId,
  userId,
  lastReadMessageId,
  lastMessageTimestamp,
  lastReadTimestamp,
}: {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  lastMessageTimestamp: number;
  lastReadTimestamp: number;
}) => {
  const convoDoc = doc(getDb(), "conversations", conversationId);
  const updateData = {
    [`readReceipts.${userId}`]: {
      lastReadMessageId,
      lastMessageTimestamp,
      lastReadTimestamp,
    },
    // The badge is a server-side counter incremented per delivered message, so
    // opening the conversation has to clear it explicitly. The read receipt
    // above is a pointer and can't be counted from without a query per
    // conversation, which is why the two live side by side.
    [`unreadCounts.${userId}`]: 0,
  };
  try {
    await updateDoc(convoDoc, updateData);
  } catch (err) {
    // [DEBUG] log removed
    throw err;
  }
};

export const listenForConversation = (
  conversationId: string,
  callback: (conversation: FirebaseFirestoreTypes.DocumentData | null) => void,
) => {
  const convoDoc = doc(getDb(), "conversations", conversationId);
  return onSnapshot(convoDoc, (snapshot) => {
    // A failed listener calls back with a null snapshot rather than throwing.
    callback(snapshot?.exists() ? snapshot.data() ?? null : null);
  });
};

export const setConversationTyping = async ({
  conversationId,
  userId,
  isTyping,
}: {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}) => {
  const convoDoc = doc(getDb(), "conversations", conversationId);
  await updateDoc(convoDoc, {
    [`typingStatus.${userId}`]: {
      isTyping,
      updatedAt: Date.now(),
    },
  });
};

// ***************************//
// Messages in a conversation //
// ***************************//
export const listenForMessages = (
  conversationId: string,
  callback: (messages: any[]) => void,
) => {
  const messagesRef = collection(
    getDb(),
    "conversations",
    conversationId,
    "messages",
  );
  const q = query(messagesRef, orderBy("timestamp"));
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(
      (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
      }),
    );
    callback(messages);
  });
};

export type MessagesPageCursor = FirebaseFirestoreTypes.QueryDocumentSnapshot;

export type MessagesPageResult = {
  messages: any[];
  oldestCursor: MessagesPageCursor | null;
  hasMore: boolean;
};

export const listenForRecentMessages = (
  conversationId: string,
  pageSize: number,
  callback: (page: MessagesPageResult) => void,
) => {
  const messagesRef = collection(
    getDb(),
    "conversations",
    conversationId,
    "messages",
  );
  const q = query(messagesRef, orderBy("timestamp", "desc"), limit(pageSize));
  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs;
    const messages = docs
      .map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .reverse();

    callback({
      messages,
      oldestCursor: docs.length > 0 ? docs[docs.length - 1] : null,
      hasMore: docs.length === pageSize,
    });
  });
};

export const fetchOlderMessagesPage = async ({
  conversationId,
  pageSize,
  oldestCursor,
}: {
  conversationId: string;
  pageSize: number;
  oldestCursor: MessagesPageCursor | null;
}): Promise<MessagesPageResult> => {
  if (!oldestCursor) {
    return {
      messages: [],
      oldestCursor: null,
      hasMore: false,
    };
  }

  const messagesRef = collection(
    getDb(),
    "conversations",
    conversationId,
    "messages",
  );
  const q = query(
    messagesRef,
    orderBy("timestamp", "desc"),
    startAfter(oldestCursor),
    limit(pageSize),
  );
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  return {
    messages: docs
      .map((messageDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
        id: messageDoc.id,
        ...messageDoc.data(),
      }))
      .reverse(),
    oldestCursor: docs.length > 0 ? docs[docs.length - 1] : oldestCursor,
    hasMore: docs.length === pageSize,
  };
};

export type SendMessageInput = {
  text?: string;
  kind?: MessageKind;
  image?: MessageImage;
  media?: MessageMedia[];
  sender: string;
  timestamp: number;
  receiverId: string;
  replyTo?: ReplyReference;
  receiverPushToken?: string | null;
  senderPushToken?: string | null;
};

const resolveMessageKind = (message: SendMessageInput): MessageKind => {
  const hasText = typeof message.text === "string" && message.text.trim().length > 0;
  const media = message.media ?? [];
  const firstMedia = media[0];
  const hasMedia = media.length > 0 || Boolean(message.image?.url);
  if (!hasMedia) return "text";
  if (hasText) return "mixed";
  if (media.length > 1) return "album";
  if (firstMedia?.type === "video") return "video";
  return "image";
};

/** `MessageMedia` minus the fields the legacy `image` shape never had. */
const stripMediaType = (media: MessageMedia): MessageImage => {
  const { type, durationMs, ...image } = media;
  void type;
  void durationMs;
  return image;
};

/**
 * Drops keys whose value is `undefined`.
 *
 * Firestore rejects `undefined` outright rather than skipping it, and an
 * attachment legitimately has gaps: the picker returns no file name for many
 * videos, and a pasted image has neither a name nor a size. Without this an
 * ordinary send fails with "Unsupported field value: undefined".
 */
const withoutUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;

const buildMessagePayload = (
  message: SendMessageInput,
): FirebaseFirestoreTypes.DocumentData => {
  const payload: FirebaseFirestoreTypes.DocumentData = {
    sender: message.sender,
    timestamp: message.timestamp,
    receiverId: message.receiverId,
    kind: message.kind ?? resolveMessageKind(message),
  };

  if (typeof message.text === "string") {
    payload.text = message.text;
  }
  const media = message.media ?? [];
  if (media.length > 0) {
    payload.media = media.map(withoutUndefined);
  }
  // Clients shipped before `media` existed read `image` and nothing else, so
  // mirror the first attachment there whenever it is one they can render.
  const legacyImage =
    message.image ??
    (media[0]?.type === "image" ? stripMediaType(media[0]) : undefined);
  if (legacyImage) {
    payload.image = withoutUndefined(legacyImage);
  }
  if (message.replyTo) {
    payload.replyTo = message.replyTo;
  }
  if (message.receiverPushToken !== undefined) {
    payload.receiverPushToken = message.receiverPushToken;
  }
  if (message.senderPushToken !== undefined) {
    payload.senderPushToken = message.senderPushToken;
  }
  return payload;
};

export const sendMessage = async (
  conversationId: string,
  message: SendMessageInput,
) => {
  try {
    const messagesRef = collection(
      getDb(),
      "conversations",
      conversationId,
      "messages",
    );
    const payload = buildMessagePayload(message);
    const docRef = await addDoc(messagesRef, payload);
    console.log("Document written with ID: ", docRef.id);
    // Optionally update lastMessage on conversation
    const convoDoc = doc(getDb(), "conversations", conversationId);
    await updateDoc(convoDoc, { lastMessage: { ...payload, id: docRef.id } });
  } catch (error) {
    Alert.alert("Failed to send message. Please try again.");
    console.error("Error adding document: ", error);
    throw error;
  }
};

type UploadConversationMediaInput = {
  conversationId: string;
  senderId: string;
  /** Defaults to "image", which is what every caller sent before video existed. */
  mediaType?: MessageMediaType;
  localUri?: string;
  dataUri?: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  sizeBytes?: number;
};

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isStorageObjectNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const code =
    "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";
  const message =
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return code.includes("storage/object-not-found") || message.includes("storage/object-not-found");
};

const getDownloadURLWithRetry = async (
  imageRef: ReturnType<ReturnType<typeof getStorage>["ref"]>,
): Promise<string> => {
  const retryDelaysMs = [200, 500, 900];
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      return await imageRef.getDownloadURL();
    } catch (error) {
      lastError = error;
      if (!isStorageObjectNotFoundError(error) || attempt === retryDelaysMs.length) {
        throw error;
      }
      await wait(retryDelaysMs[attempt]);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to resolve uploaded image URL");
};

const toGsUrl = (bucket: string) =>
  bucket.startsWith("gs://") ? bucket : `gs://${bucket}`;

const getAlternateBucketUrl = (): string | null => {
  const configuredBucket = getStorage().app.options.storageBucket;
  if (typeof configuredBucket !== "string" || configuredBucket.trim().length === 0) {
    return null;
  }

  const bucket = configuredBucket.trim().replace(/^gs:\/\//, "");
  if (bucket.endsWith(".firebasestorage.app")) {
    return toGsUrl(bucket.replace(".firebasestorage.app", ".appspot.com"));
  }
  if (bucket.endsWith(".appspot.com")) {
    return toGsUrl(bucket.replace(".appspot.com", ".firebasestorage.app"));
  }
  return null;
};

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/webm": "webm",
  "video/3gpp": "3gp",
};

const resolveMediaExtension = (
  mediaType: MessageMediaType,
  fileName?: string,
  mimeType?: string,
  localUri?: string,
): string => {
  if (mimeType && MIME_TO_EXTENSION[mimeType.toLowerCase()]) {
    return MIME_TO_EXTENSION[mimeType.toLowerCase()];
  }
  const source = fileName ?? localUri ?? "";
  const extensionMatch = source.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (extensionMatch?.[1]) {
    return extensionMatch[1].toLowerCase();
  }
  return mediaType === "video" ? "mp4" : "jpg";
};

const toBase64 = (dataUriOrBase64: string): string => {
  const marker = "base64,";
  const markerIndex = dataUriOrBase64.indexOf(marker);
  if (markerIndex === -1) {
    return dataUriOrBase64;
  }
  return dataUriOrBase64.slice(markerIndex + marker.length);
};

export const uploadConversationMedia = async (
  input: UploadConversationMediaInput,
): Promise<MessageMedia> => {
  const {
    conversationId,
    senderId,
    mediaType = "image",
    localUri,
    dataUri,
    fileName,
    mimeType,
    width,
    height,
    durationMs,
    sizeBytes,
  } = input;

  if (!localUri && !dataUri) {
    throw new Error("Missing media source for upload");
  }

  const extension = resolveMediaExtension(
    mediaType,
    fileName,
    mimeType,
    localUri,
  );
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  // Everything still lands under `images/`: the Storage rules are written
  // against that prefix, and renaming it would lock out uploads until they are
  // redeployed.
  const storagePath =
    `conversations/${conversationId}/images/${senderId}/${uniqueSuffix}.${extension}`;
  const metadata = mimeType ? {contentType: mimeType} : undefined;

  const uploadToRef = async (
    mediaRef: ReturnType<ReturnType<typeof getStorage>["ref"]>,
  ) => {
    if (localUri) {
      try {
        await mediaRef.putFile(
          localUri,
          metadata,
        );
      } catch (error) {
        if (!dataUri) {
          throw error;
        }
        const base64 = toBase64(dataUri);
        await mediaRef.putString(
          base64,
          "base64",
          metadata,
        );
      }
      return;
    }

    if (dataUri) {
      const base64 = toBase64(dataUri);
      await mediaRef.putString(
        base64,
        "base64",
        metadata,
      );
    }
  };

  let mediaRef = getStorage().ref(storagePath);
  try {
    await uploadToRef(mediaRef);
  } catch (error) {
    const alternateBucketUrl = getAlternateBucketUrl();
    const canRetryWithAlternateBucket =
      isStorageObjectNotFoundError(error) && Boolean(alternateBucketUrl);

    if (!canRetryWithAlternateBucket || !alternateBucketUrl) {
      throw error;
    }

    mediaRef = getStorage(alternateBucketUrl).ref(storagePath);
    await uploadToRef(mediaRef);
  }

  const url = await getDownloadURLWithRetry(mediaRef);
  const uploaded: MessageMedia = {
    url,
    storagePath,
    type: mediaType,
    width,
    height,
    mimeType,
    fileName,
    sizeBytes,
  };
  if (mediaType === "video" && typeof durationMs === "number") {
    uploaded.durationMs = durationMs;
  }

  return uploaded;
};

export const editMessage = (
  conversationId: string,
  messageId: string,
  newText: string,
) => {
  const messageDoc = doc(
    getDb(),
    "conversations",
    conversationId,
    "messages",
    messageId,
  );
  return updateDoc(messageDoc, { text: newText, edited: true });
};

export const setMessageReaction = ({
  conversationId,
  messageId,
  userId,
  emoji,
}: {
  conversationId: string;
  messageId: string;
  userId: string;
  emoji: string | null;
}) => {
  const messageDoc = doc(
    getDb(),
    "conversations",
    conversationId,
    "messages",
    messageId,
  );

  return updateDoc(messageDoc, {
    [`reactions.${userId}`]:
      emoji === null ? firestore.FieldValue.delete() : emoji,
  });
};

export const deleteMessage = (conversationId: string, messageId: string) => {
  const messageDoc = doc(
    getDb(),
    "conversations",
    conversationId,
    "messages",
    messageId,
  );
  return deleteDoc(messageDoc);
};

// ***************************//
// -----------Users-----------//
// ***************************//
type UserProfileData = {
  fname?: string;
  lname?: string;
  phone?: string;
  email?: string;
};

const normalizeUserProfileData = (data: UserProfileData) => {
  const normalized: UserProfileData = {};
  const entries = Object.entries(data) as [keyof UserProfileData, string | undefined][];

  for (const [key, value] of entries) {
    if (typeof value !== "string") continue;
    const trimmedValue = value.trim();
    if (trimmedValue.length > 0) {
      normalized[key] = trimmedValue;
    }
  }

  return normalized;
};

export const createUserProfile = async (
  uid: string,
  data: UserProfileData,
) => {
  const db = getDb();
  const userDoc = doc(db, "Users", uid);
  const normalizedData = normalizeUserProfileData(data);
  const serverNow = () => firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userDoc);

    if (snapshot.exists()) {
      const existing = snapshot.data() ?? {};
      const updates: Record<string, unknown> = {
        ...normalizedData,
        updatedAt: serverNow(),
        lastSignIn: serverNow(),
      };
      if (!existing.createdAt) {
        updates.createdAt = serverNow();
      }
      transaction.set(userDoc, updates, { merge: true });
      return;
    }

    transaction.set(userDoc, {
      fname: "",
      lname: "",
      phone: "",
      email: "",
      ...normalizedData,
      createdAt: serverNow(),
      updatedAt: serverNow(),
      lastSignIn: serverNow(),
    });
  });
};

export const updateUserExpoPushToken = async (
  uid: string,
  expoPushToken: string,
) => {
  const userDoc = doc(getDb(), "Users", uid);
  // Apple wants background/silent pushes at normal priority while Android needs
  // high priority to survive doze, and an Expo token doesn't say which platform
  // it came from — so record it here.
  await updateDoc(userDoc, { expoPushToken, expoPushPlatform: Platform.OS });
};

export const getUserExpoPushToken = async (uid: string) => {
  const userDoc = doc(getDb(), "Users", uid);
  const userSnap = await getDoc(userDoc);
  if (!userSnap.exists()) {
    return null;
  }
  const userData = userSnap.data();
  return userData?.expoPushToken ?? null;
};

// ***************************//
// -------Unread counts-------//
// ***************************//

/** Unread totals keyed by the *other* participant's id. */
export type UnreadByContact = Record<string, number>;

/**
 * One listener covering every conversation this user is in, so a badge on a
 * contact row costs a field read rather than a query per row. The count itself
 * is maintained by the sendPushNotification trigger — a client can't be trusted
 * to count messages it may never have received.
 */
export const listenForUnreadCounts = (
  userId: string,
  callback: (counts: UnreadByContact) => void,
) => {
  const q = query(
    getConversationsRef(),
    where("participants", "array-contains", userId),
  );

  return onSnapshot(
    q,
    (snapshot: FirebaseFirestoreTypes.QuerySnapshot) => {
      if (!snapshot) {
        callback({});
        return;
      }
      const counts: UnreadByContact = {};
      snapshot.docs.forEach(
        (convo: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
          const data = convo.data() ?? {};
          const participants = Array.isArray(data.participants) ?
            data.participants :
            [];
          const other = participants.find(
            (id: unknown) => typeof id === "string" && id !== userId,
          );
          if (typeof other !== "string") return;

          const raw = data.unreadCounts?.[userId];
          const count =
            typeof raw === "number" && Number.isFinite(raw) && raw > 0 ?
              Math.floor(raw) :
              0;
          if (count > 0) {
            counts[other] = (counts[other] ?? 0) + count;
          }
        },
      );
      callback(counts);
    },
    () => callback({}),
  );
};
