import { AuthUser, ConversationDoc, UserDoc } from "@/app/types/firestore";
import { getAuth, signOut } from "@react-native-firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  where,
  type FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { useRouter } from "expo-router";
import { FC, useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "../../../components/themed-text";
import { IconSymbol } from "../../../components/ui/icon-symbol";
import { Colors } from "../../../constants/theme";
import styles from "./styles";

const AVATAR_COLORS = ["#007AFF", "#34C759", "#FF9500", "#AF52DE", "#FF2D55"];

type ContactsScreenProps = {
  user: AuthUser;
};

type Message = {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
};

type ReadReceipts = {
  [userId: string]: {
    lastReadMessageId: string;
    timestamp: number;
  };
};

type Conversation = {
  id: string;
  participants: string[];
  lastMessage?: Message;
  readReceipts?: ReadReceipts;
};

const ContactsScreen: FC<ContactsScreenProps> = ({ user }) => {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [contacts, setContacts] = useState<UserDoc[]>([]);
  const [myUser, setMyUser] = useState<UserDoc | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const db = getFirestore();
    let unsubConvos: (() => void) | null = null;
    let ignore = false;
    // Fetch all users except current (one-time)
    (async () => {
      try {
        const usersCol = collection(db, "Users");
        const usersSnap = await getDocs(usersCol);
        const allUsers = usersSnap.docs.map(
          (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
            id: doc.id,
            ...(doc.data() as Omit<UserDoc, "id">),
          }),
        );
        const myUser = allUsers.find((u: UserDoc) => u.id === user.uid);
        if (!myUser) {
          console.warn("Current user document not found in Users collection");
        }
        const users = allUsers.filter((u: UserDoc) => u.id !== user.uid);
        if (!ignore) {
          setContacts(users);
        }
        setMyUser(myUser);
      } catch (e) {
        console.error("Failed to fetch contacts:", e);
      }
    })();

    // Listen for conversations in real-time
    const convosCol = collection(db, "conversations");
    const q = query(
      convosCol,
      where("participants", "array-contains", user.uid),
    );
    unsubConvos = onSnapshot(q, (convosSnap) => {
      const convos: Conversation[] = convosSnap.docs.map(
        (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
          const data = doc.data() as Omit<ConversationDoc, "id">;
          return {
            id: doc.id,
            participants: Array.isArray(data.participants)
              ? data.participants
              : [],
            lastMessage: data.lastMessage
              ? {
                  id: data.lastMessage.id ?? "",
                  text: data.lastMessage.text ?? "",
                  sender: data.lastMessage.sender ?? "",
                  timestamp: data.lastMessage.timestamp ?? 0,
                }
              : undefined,
            readReceipts: data.readReceipts ?? undefined,
          };
        },
      );
      if (!ignore) {
        setConversations(convos);
      }
    });
    return () => {
      ignore = true;
      unsubConvos?.();
    };
  }, [user.uid]);

  const handleLogout = async () => {
    try {
      await signOut(getAuth());
    } catch {
      // ignore
    }
    setMenuVisible(false);
  };

  const handlePress = useCallback(
    (contact: { id: string; name: string }) => {
      router.push({
        pathname: "/screens/MessagingScreen",
        params: { contactId: contact.id, contactName: contact.name },
      });
    },
    [router],
  );

  // Helper to format date as "yesterday", "friday", or MM/DD/YY
  const formatDate = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const diff =
      (now.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) / 86400000;
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7)
      return date.toLocaleDateString(undefined, { weekday: "long" });
    return date.toLocaleDateString();
  };

  const renderItem = useCallback(
    ({ item, index }: { item: UserDoc; index: number }) => {
      const initials = ((item.fname ?? "") + " " + (item.lname ?? ""))
        .split(" ")
        .map((n) => n?.[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
      const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
      // Find conversation with this contact
      const convo = conversations.find(
        (c) =>
          Array.isArray(c.participants) &&
          c.participants.includes(user.uid) &&
          c.participants.includes(item.id),
      );
      const lastMsg = convo?.lastMessage;
      let lastMsgText = lastMsg?.text ?? "";
      if (lastMsgText.length > 120)
        lastMsgText = lastMsgText.slice(0, 120) + "...";
      // Format as 2-line snippet
      const snippet = lastMsgText
        ? lastMsgText.split("\n").slice(0, 2).join("\n")
        : "";
      const lastMsgTime = lastMsg?.timestamp
        ? formatDate(lastMsg.timestamp)
        : "";
      // Unread logic: show blue dot if the last message was sent by the other party and user has not read it
      let showUnreadDot = false;
      if (convo && lastMsg && lastMsg.sender !== user.uid) {
        const readReceipts = convo.readReceipts || {};
        const receipt = readReceipts[user.uid];
        if (!receipt || receipt.lastReadMessageId !== lastMsg.id) {
          showUnreadDot = true;
        }
      }
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() =>
            handlePress({
              id: item.id,
              name: `${item.fname || ""} ${item.lname || ""}`.trim(),
            })
          }
          activeOpacity={0.7}
        >
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <ThemedText style={styles.avatarText}>{initials}</ThemedText>
          </View>
          <View style={styles.info}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {showUnreadDot && <View style={styles.unreadDot} />}
              <ThemedText type="defaultSemiBold" style={styles.name}>
                {`${item.fname || ""} ${item.lname || ""}`.trim()}
              </ThemedText>
            </View>
            <ThemedText style={styles.lastMessage} numberOfLines={2}>
              {snippet}
            </ThemedText>
          </View>
          {lastMsgTime ? (
            <Text
              style={{
                color: Colors.light.icon,
                marginRight: 8,
                minWidth: 60,
                textAlign: "right",
              }}
            >
              {lastMsgTime}
            </Text>
          ) : null}
          <IconSymbol
            name="chevron.right"
            size={22}
            color={Colors.light.icon}
            style={styles.chevron}
          />
        </TouchableOpacity>
      );
    },
    [conversations, handlePress, user.uid],
  );

  // User avatar initials
  const fullName = myUser
    ? `${myUser.fname ?? ""} ${myUser.lname ?? ""}`.trim()
    : "";
  const initials = (user.displayName ?? fullName ?? "?")
    .split(" ")
    .map((n: string) => n?.[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const avatarColor = Colors.light.tint;
  const hamburgerColor = Colors.light.icon;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Top bar with avatar and hamburger menu at top right */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderColor: Colors.light.border,
          backgroundColor: Colors.light.background,
        }}
      >
        <ThemedText
          type="title"
          style={{
            fontSize: 22,
            fontWeight: "bold",
            color: Colors.light.text,
            flex: 1,
            textAlign: "center",
          }}
        >
          Contacts
        </ThemedText>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            position: "absolute",
            right: 16,
            top: 8,
          }}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: avatarColor, marginRight: 4 },
            ]}
          >
            <ThemedText style={styles.avatarText}>{initials}</ThemedText>
          </View>
          <Pressable
            onPress={() => setMenuVisible(true)}
            style={{ padding: 4 }}
          >
            <IconSymbol
              name="line.3.horizontal"
              size={28}
              color={hamburgerColor}
            />
          </Pressable>
        </View>
      </View>
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setMenuVisible(false)}>
          <View
            style={{
              position: "absolute",
              top: 56,
              right: 24,
              backgroundColor: "#fff",
              borderRadius: 8,
              elevation: 4,
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 8,
              minWidth: 120,
            }}
          >
            <Pressable onPress={handleLogout} style={{ padding: 16 }}>
              <Text style={{ color: "#d00", fontWeight: "bold" }}>Logout</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingTop: 24 }]}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

export default ContactsScreen;
