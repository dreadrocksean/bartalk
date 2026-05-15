import { usePushNotifications } from "@/hooks/use-push-notifications";
import { getAuth } from "@react-native-firebase/auth";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  editMessage,
  getOrCreateConversation,
  getUserExpoPushToken,
  listenForMessages,
  markConversationRead,
  sendMessage,
} from "../../../api";

import { MessageDoc } from "../../types/firestore";

import { Colors } from "../../../constants/theme";
import styles from "./styles";

const MessagingScreen = () => {
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({
      title: "Messages",
      headerBackTitle: "Contacts",
    });
  }, [navigation]);
  const { contactId } = useLocalSearchParams();
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const { permissionStatus, requestPushPermissionAndToken } =
    usePushNotifications();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [receiverPushToken, setReceiverPushToken] = useState<string | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      let unsubscribe: (() => void) | null = null;
      (async () => {
        await requestPushPermissionAndToken();
        const currentUser = getAuth().currentUser;
        if (!currentUser) return;
        try {
          const pushToken = await getUserExpoPushToken(String(contactId));
          setReceiverPushToken(pushToken);
        } catch {
          setReceiverPushToken(null);
        }
        const convoRef = await getOrCreateConversation(
          currentUser.uid,
          String(contactId),
        );
        if (!isActive) return;
        setConversationId(convoRef.id);
        unsubscribe = listenForMessages(convoRef.id, async (msgs: any[]) => {
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
        });
      })();
      return () => {
        isActive = false;
        if (unsubscribe) unsubscribe();
      };
    }, [contactId, requestPushPermissionAndToken]),
  );

  const handleSend = async () => {
    Keyboard.dismiss();
    if (!conversationId || input.trim().length === 0) return;
    try {
      const currentUser = getAuth().currentUser;
      // Get sender's push token (if not already stored)
      let senderPushToken = null;
      try {
        if (currentUser?.uid) {
          senderPushToken = await getUserExpoPushToken(currentUser.uid);
        }
      } catch {}
      await sendMessage(conversationId, {
        text: input,
        sender: currentUser ? currentUser.uid : "",
        receiverId: String(contactId),
        timestamp: Date.now(),
        receiverPushToken,
        senderPushToken,
      });
      setInput("");
      if (permissionStatus === "granted") {
        await import("expo-notifications").then(
          ({ scheduleNotificationAsync }) =>
            scheduleNotificationAsync({
              content: {
                title: "Message sent",
                body: input,
              },
              trigger: null,
            }),
        );
      }
    } catch (err) {
      console.error("Error sending message to Firestore:", err);
      const msg =
        typeof err === "object" && err && "message" in err
          ? (err as any).message
          : String(err);
      alert("Failed to send message: " + msg);
    }
  };

  const handleEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  };

  const handleEditSave = async () => {
    if (editingId && conversationId) {
      await editMessage(conversationId, editingId, editingText);
    }
    setEditingId(null);
    setEditingText("");
  };

  const renderItem = ({ item }: { item: MessageDoc }) => {
    const isMe = item.sender === getAuth().currentUser?.uid;
    return (
      <TouchableOpacity
        onLongPress={() => isMe && handleEdit(item.id, item.text)}
        style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}
        activeOpacity={isMe ? 0.7 : 1}
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
          <>
            <Text
              style={[
                styles.bubbleText,
                isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
              ]}
            >
              {item.text}
            </Text>
            {item.edited && <Text style={styles.edited}>(edited)</Text>}
          </>
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
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
        <View style={{ flexShrink: 0 }}>
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
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
          {/* Status message removed as requested */}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default MessagingScreen;
