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

  menuFooterDivider: {
    height: unity * 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: unity * 12,
  },
  menuFooter: {
    paddingHorizontal: unity * 16,
    paddingVertical: unity * 12,
    gap: unity * 3,
  },
  menuFooterText: {
    fontSize: unity * 12,
    color: Colors.light.icon,
  },

  // Time above, count below, right-aligned as one column — the arrangement a
  // chat list is read in: when, then how much is waiting.
  meta: {
    minWidth: unity * 60,
    marginRight: unity * 8,
    alignItems: "flex-end",
    gap: unity * 5,
  },
  metaTime: { color: Colors.light.icon, textAlign: "right" },
  unreadBadge: {
    minWidth: unity * 22,
    height: unity * 22,
    borderRadius: unity * 11,
    paddingHorizontal: unity * 7,
    backgroundColor: "#E5342B",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: unity * 13,
    fontWeight: "800",
    includeFontPadding: false,
    textAlign: "center",
  },
  unreadDot: {
    width: unity * 10,
    height: unity * 10,
    borderRadius: unity * 5,
    backgroundColor: Colors.light.bubbleMe,
    marginRight: unity * 8,
    alignSelf: "center",
  },
});
