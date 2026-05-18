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
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "@react-native-firebase/firestore";
import { Alert } from "react-native";
import type {
  MessageImage,
  MessageKind,
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
  const q = query(conversationsRef, orderBy("participants"));
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
    callback(snapshot.exists() ? snapshot.data() ?? null : null);
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

export type SendMessageInput = {
  text?: string;
  kind?: MessageKind;
  image?: MessageImage;
  sender: string;
  timestamp: number;
  receiverId: string;
  replyTo?: ReplyReference;
  receiverPushToken?: string | null;
  senderPushToken?: string | null;
};

const resolveMessageKind = (message: SendMessageInput): MessageKind => {
  const hasText = typeof message.text === "string" && message.text.trim().length > 0;
  const hasImage = Boolean(message.image?.url);
  if (hasText && hasImage) return "mixed";
  if (hasImage) return "image";
  return "text";
};

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
  if (message.image) {
    payload.image = message.image;
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

type UploadConversationImageInput = {
  conversationId: string;
  senderId: string;
  localUri?: string;
  dataUri?: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
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

const awaitUploadTask = async (
  task: ReturnType<ReturnType<ReturnType<typeof getStorage>["ref"]>["putString"]>,
) => {
  await new Promise((resolve, reject) => {
    task.then(resolve).catch(reject);
  });
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
};

const resolveImageExtension = (
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
  return "jpg";
};

const toBase64 = (dataUriOrBase64: string): string => {
  const marker = "base64,";
  const markerIndex = dataUriOrBase64.indexOf(marker);
  if (markerIndex === -1) {
    return dataUriOrBase64;
  }
  return dataUriOrBase64.slice(markerIndex + marker.length);
};

export const uploadConversationImage = async (
  input: UploadConversationImageInput,
): Promise<MessageImage> => {
  const {
    conversationId,
    senderId,
    localUri,
    dataUri,
    fileName,
    mimeType,
    width,
    height,
    sizeBytes,
  } = input;

  if (!localUri && !dataUri) {
    throw new Error("Missing image source for upload");
  }

  const extension = resolveImageExtension(fileName, mimeType, localUri);
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath =
    `conversations/${conversationId}/images/${senderId}/${uniqueSuffix}.${extension}`;
  const metadata = mimeType ? {contentType: mimeType} : undefined;

  const uploadToRef = async (
    imageRef: ReturnType<ReturnType<typeof getStorage>["ref"]>,
  ) => {
    if (localUri) {
      try {
        await awaitUploadTask(
          imageRef.putFile(
            localUri,
            metadata,
          ),
        );
      } catch (error) {
        if (!dataUri) {
          throw error;
        }
        const base64 = toBase64(dataUri);
        await awaitUploadTask(
          imageRef.putString(
            base64,
            "base64",
            metadata,
          ),
        );
      }
      return;
    }

    if (dataUri) {
      const base64 = toBase64(dataUri);
      await awaitUploadTask(
        imageRef.putString(
          base64,
          "base64",
          metadata,
        ),
      );
    }
  };

  let imageRef = getStorage().ref(storagePath);
  try {
    await uploadToRef(imageRef);
  } catch (error) {
    const alternateBucketUrl = getAlternateBucketUrl();
    const canRetryWithAlternateBucket =
      isStorageObjectNotFoundError(error) && Boolean(alternateBucketUrl);

    if (!canRetryWithAlternateBucket || !alternateBucketUrl) {
      throw error;
    }

    imageRef = getStorage(alternateBucketUrl).ref(storagePath);
    await uploadToRef(imageRef);
  }

  const url = await getDownloadURLWithRetry(imageRef);
  return {
    url,
    storagePath,
    width,
    height,
    mimeType,
    fileName,
    sizeBytes,
  };
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
  await updateDoc(userDoc, { expoPushToken });
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
