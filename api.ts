// Mark conversation as read for a user
// Create a user profile in Firestore Users collection
import {
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
  setDoc,
  updateDoc,
} from "@react-native-firebase/firestore";
import { Alert } from "react-native";
import { getFirebaseDb } from "./firebase";

// ***************************//
// -----------Setup-----------//
// ***************************//
export const getDb = () => getFirebaseDb();

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

export const sendMessage = async (
  conversationId: string,
  message: {
    text: string;
    sender: string;
    timestamp: number;
    receiverId: string;
    receiverPushToken?: string | null;
    senderPushToken?: string | null;
  },
) => {
  try {
    const messagesRef = collection(
      getDb(),
      "conversations",
      conversationId,
      "messages",
    );
    const docRef = await addDoc(messagesRef, message);
    console.log("Document written with ID: ", docRef.id);
    // Optionally update lastMessage on conversation
    const convoDoc = doc(getDb(), "conversations", conversationId);
    await updateDoc(convoDoc, { lastMessage: { ...message, id: docRef.id } });
  } catch (error) {
    Alert.alert("Failed to send message. Please try again.");
    console.error("Error adding document: ", error);
    throw error;
  }
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
export const createUserProfile = async (
  uid: string,
  data: { fname: string; lname: string; phone: string; email: string },
) => {
  const userDoc = doc(getDb(), "Users", uid);
  await setDoc(userDoc, data);
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
