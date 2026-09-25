// Firestore document types for BarTalk

import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

export type UserDoc = {
  id: string;
  fname: string;
  lname: string;
  email: string;
  phone: string;
  expoPushToken?: string;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
  lastSignIn?: FirebaseFirestoreTypes.Timestamp;
};

export type MessageKind = "text" | "image" | "video" | "album" | "mixed";

export type MessageImage = {
  url: string;
  storagePath: string;
  width?: number;
  height?: number;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
};

export type MessageMediaType = "image" | "video";

/**
 * One attachment on a message. `MessageImage` is the older single-attachment
 * shape; this is the same thing plus a kind and a duration, and it arrives in
 * an array so a message can carry several.
 */
export type MessageMedia = MessageImage & {
  type: MessageMediaType;
  /** Videos only. Milliseconds, as reported by the picker. */
  durationMs?: number;
};

/**
 * The card shown for a link in a message. Filled in by the backend shortly
 * after the message is written, so it arrives a moment later than the text.
 */
export type MessageLinkPreview = {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  /** See LINK_PREVIEW_VERSION: older cards are rebuilt when they are read. */
  version?: number;
};

export type MessageReactions = {
  [userId: string]: string;
};

export type MessageDoc = {
  id: string;
  text?: string;
  kind?: MessageKind;
  /**
   * The first attachment, repeated here so that clients shipped before
   * multi-attachment messages existed still render something. Only set when
   * that first attachment is an image.
   */
  image?: MessageImage;
  /** Every attachment, in the order the sender picked them. */
  media?: MessageMedia[];
  linkPreview?: MessageLinkPreview;
  sender: string;
  receiverId: string;
  timestamp: number;
  replyTo?: ReplyReference;
  reactions?: MessageReactions;
  edited?: boolean;
  receiverPushToken?: string | null;
  senderPushToken?: string | null;
};

export type ReplyReference = {
  messageId: string;
  senderId: string;
  snippet: string;
  type?: "text" | "image" | "video";
  deleted?: boolean;
};

export type ReadReceipt = {
  lastMessageTimestamp: number;
  lastReadMessageId: string;
  lastReadTimestamp: number;
};

export type ReadReceipts = {
  [userId: string]: ReadReceipt;
};

export type TypingStatus = {
  isTyping: boolean;
  updatedAt: number;
};

export type TypingStatuses = {
  [userId: string]: TypingStatus;
};

export type ConversationDoc = {
  id: string;
  participants: string[];
  lastMessage?: MessageDoc;
  readReceipts?: ReadReceipts;
  /** Server-maintained unread totals, keyed by recipient id. */
  unreadCounts?: { [userId: string]: number };
  typingStatus?: TypingStatuses;
};

export type AuthUser = FirebaseAuthTypes.User;
