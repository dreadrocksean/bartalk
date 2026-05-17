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

export type MessageDoc = {
  id: string;
  text: string;
  sender: string;
  receiverId: string;
  timestamp: number;
  replyTo?: ReplyReference;
  edited?: boolean;
  receiverPushToken?: string | null;
  senderPushToken?: string | null;
};

export type ReplyReference = {
  messageId: string;
  senderId: string;
  snippet: string;
  type?: "text" | "image";
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
  typingStatus?: TypingStatuses;
};

export type AuthUser = FirebaseAuthTypes.User;
