import { StyleSheet } from "react-native";

import { Colors } from "../../../constants/theme";
import { unity } from "../../utils/general";

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: unity * 16,
    paddingTop: unity * 8,
    paddingBottom: unity * 8,
    borderBottomWidth: unity * 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  headerTitle: {
    fontSize: unity * 22,
    fontWeight: "bold",
    color: Colors.light.text,
  },
  headerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: unity * 6,
    paddingVertical: unity * 6,
    paddingHorizontal: unity * 10,
    borderRadius: unity * 14,
    backgroundColor: Colors.light.tint,
  },
  headerActionText: { color: "#fff", fontWeight: "700", fontSize: unity * 13 },

  scroll: { paddingBottom: unity * 32 },
  sectionTitle: {
    fontSize: unity * 13,
    fontWeight: "700",
    color: Colors.light.icon,
    textTransform: "uppercase",
    letterSpacing: unity * 0.6,
    marginTop: unity * 22,
    marginBottom: unity * 8,
    marginHorizontal: unity * 16,
  },
  sectionNote: {
    fontSize: unity * 12,
    color: Colors.light.icon,
    marginHorizontal: unity * 16,
    marginBottom: unity * 8,
    lineHeight: unity * 17,
  },

  card: {
    backgroundColor: Colors.light.bubbleOther,
    borderTopWidth: unity * 1,
    borderBottomWidth: unity * 1,
    borderColor: Colors.light.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: unity * 12,
    paddingHorizontal: unity * 16,
    gap: unity * 12,
  },
  rowDivider: {
    height: unity * 1,
    backgroundColor: Colors.light.border,
    marginLeft: unity * 74,
  },
  avatar: {
    width: unity * 46,
    height: unity * 46,
    borderRadius: unity * 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
  },
  avatarText: { color: "#fff", fontWeight: "600", fontSize: unity * 18 },
  rowInfo: { flex: 1, gap: unity * 2 },
  rowName: {
    fontSize: unity * 17,
    fontWeight: "600",
    color: Colors.light.text,
  },
  rowStatus: { fontSize: unity * 13, color: Colors.light.icon },
  rowStatusWarn: { fontSize: unity * 13, color: "#B4541F" },

  rowButtons: { flexDirection: "row", gap: unity * 8 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: unity * 5,
    paddingVertical: unity * 8,
    paddingHorizontal: unity * 12,
    borderRadius: unity * 16,
    borderWidth: unity * 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  actionButtonPrimary: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  actionButtonText: {
    fontSize: unity * 13,
    fontWeight: "700",
    color: Colors.light.text,
  },
  actionButtonTextPrimary: { color: "#fff" },
  actionButtonTextDanger: { color: "#B00020" },

  // Sits inside the button rather than pinned to its corner: the count is part
  // of what the button says ("Chat, 3 waiting"), not a decoration floating over
  // it, and an inline badge can't clip against the row's edge.
  actionBadge: {
    minWidth: unity * 20,
    height: unity * 20,
    borderRadius: unity * 10,
    paddingHorizontal: unity * 6,
    backgroundColor: "#E5342B",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBadgeText: {
    color: "#fff",
    fontSize: unity * 12,
    fontWeight: "800",
    // Digits in a pill look low without this on iOS.
    includeFontPadding: false,
    textAlign: "center",
  },

  requestActions: { flexDirection: "row", gap: unity * 8 },
  requestBody: {
    fontSize: unity * 13,
    color: Colors.light.icon,
    lineHeight: unity * 18,
    paddingHorizontal: unity * 16,
    paddingBottom: unity * 12,
  },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: unity * 10,
    paddingVertical: unity * 10,
    paddingHorizontal: unity * 16,
  },
  historyText: { flex: 1, fontSize: unity * 14, color: Colors.light.text },
  historyMeta: { fontSize: unity * 12, color: Colors.light.icon },

  empty: {
    paddingHorizontal: unity * 16,
    paddingVertical: unity * 18,
    gap: unity * 6,
  },
  emptyTitle: {
    fontSize: unity * 15,
    fontWeight: "600",
    color: Colors.light.text,
  },
  emptyBody: {
    fontSize: unity * 13,
    color: Colors.light.icon,
    lineHeight: unity * 19,
  },

  // -------- Contact picker --------
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: unity * 18,
    borderTopRightRadius: unity * 18,
    paddingBottom: unity * 28,
    maxHeight: "72%",
  },
  modalHandle: {
    alignSelf: "center",
    width: unity * 40,
    height: unity * 4,
    borderRadius: unity * 2,
    backgroundColor: Colors.light.border,
    marginVertical: unity * 10,
  },
  modalTitle: {
    fontSize: unity * 18,
    fontWeight: "700",
    color: Colors.light.text,
    marginHorizontal: unity * 16,
  },
  modalBody: {
    fontSize: unity * 13,
    color: Colors.light.icon,
    marginHorizontal: unity * 16,
    marginTop: unity * 4,
    marginBottom: unity * 10,
    lineHeight: unity * 19,
  },
});
