import { StyleSheet } from "react-native";
import { Colors } from "../../../constants/theme";
import { unity } from "../../utils/general";

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    fontSize: unity * 34,
    fontWeight: "bold",
    marginBottom: unity * 8,
    marginTop: unity * 8,
    marginLeft: unity * 4,
  },
  searchBar: {
    backgroundColor: Colors.light.inputBar,
    borderRadius: unity * 8,
    paddingHorizontal: unity * 12,
    paddingVertical: unity * 8,
    marginHorizontal: unity * 8,
    marginBottom: unity * 12,
    fontSize: unity * 16,
    borderWidth: unity * 1,
    borderColor: Colors.light.border,
  } as const,
  list: { paddingTop: unity * 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: unity * 12,
    paddingHorizontal: unity * 16,
    backgroundColor: Colors.light.bubbleOther,
    borderBottomWidth: unity * 1,
    borderColor: Colors.light.border,
  },
  avatar: {
    width: unity * 48,
    height: unity * 48,
    borderRadius: unity * 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: unity * 14,
    backgroundColor: Colors.light.tint,
  },
  avatarText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: unity * 20,
  },
  info: { flex: 1 },
  name: { fontSize: unity * 18, marginBottom: unity * 2 },
  lastMessage: { color: Colors.light.icon, fontSize: unity * 15 },
  chevron: { marginLeft: unity * 8 },
  unreadDot: {
    width: unity * 10,
    height: unity * 10,
    borderRadius: unity * 5,
    backgroundColor: Colors.light.bubbleMe,
    marginRight: unity * 8,
    alignSelf: "center",
  },
});
