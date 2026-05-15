// Firestore document types for BarTalk

import type { FirebaseAuthTypes } from "@react-native-firebase/auth";

export type UserDoc = {
  id: string;
  fname: string;
  lname: string;
  email: string;
  phone: string;
  expoPushToken?: string;
};

export type MessageDoc = {
  id: string;
  text: string;
  sender: string;
  receiverId: string;
  timestamp: number;
  edited?: boolean;
  receiverPushToken?: string | null;
  senderPushToken?: string | null;
};

export type ReadReceipt = {
  lastMessageTimestamp: number;
  lastReadMessageId: string;
  lastReadTimestamp: number;
};

export type ReadReceipts = {
  [userId: string]: ReadReceipt;
};

export type ConversationDoc = {
  id: string;
  participants: string[];
  lastMessage?: MessageDoc;
  readReceipts?: ReadReceipts;
};

export type AuthUser = FirebaseAuthTypes.User;
