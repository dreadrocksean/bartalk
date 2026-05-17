import { Platform, StyleSheet } from "react-native";
import { Colors } from "../../../constants/theme";

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: "#e5e5ea" },
  list: { padding: 16, paddingBottom: 140 },
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 22,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    flexDirection: "row",
    alignItems: "center",
  },
  bubbleContent: {
    flexShrink: 1,
  },
  bubbleHighlighted: {
    borderWidth: 1,
    borderColor: "#0A84FF",
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: Colors.light.bubbleMe,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: Colors.light.bubbleOther,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    fontSize: 16,
    fontFamily: Platform.select({
      ios: "San Francisco",
      android: "Roboto",
      default: "Arial",
    }),
  },
  bubbleTextMe: {
    color: Colors.light.bubbleTextMe,
  },
  bubbleTextOther: {
    color: Colors.light.bubbleTextOther,
  },
  edited: {
    fontSize: 12,
    color: "#888",
    marginLeft: 6,
    alignSelf: "flex-end",
  },
  replyQuote: {
    borderRadius: 10,
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  replyQuoteMe: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderLeftColor: "rgba(255, 255, 255, 0.85)",
  },
  replyQuoteOther: {
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    borderLeftColor: "#4B5563",
  },
  replyQuoteLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  replyQuoteLabelMe: {
    color: "rgba(255, 255, 255, 0.95)",
  },
  replyQuoteLabelOther: {
    color: "#374151",
  },
  replyQuoteText: {
    fontSize: 13,
  },
  replyQuoteTextMe: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  replyQuoteTextOther: {
    color: "#111827",
  },
  typingBubbleContainer: {
    alignSelf: "flex-start",
    marginTop: 2,
    marginBottom: 8,
  },
  typingBubble: {
    minWidth: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  composerContainer: {
    borderTopWidth: 1,
    borderColor: "#e5e5ea",
    backgroundColor: "#f9f9f9",
  },
  replyComposer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  replyComposerTextWrap: {
    flex: 1,
  },
  replyComposerLabel: {
    color: "#0A84FF",
    fontSize: 12,
    fontWeight: "600",
  },
  replyComposerText: {
    color: "#4B5563",
    fontSize: 13,
    marginTop: 1,
  },
  replyComposerClose: {
    marginLeft: 8,
    height: 24,
    width: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  replyComposerCloseText: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "700",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9f9f9",
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    fontSize: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  sendBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  saveBtn: {
    backgroundColor: "#e5e5ea",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  messageActionSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  messageActionSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
  },
  messageActionSheetCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 24,
  },
  messageActionSheetEmojiScroll: {
    marginBottom: 6,
  },
  messageActionSheetEmojiRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingRight: 6,
  },
  messageActionSheetEmojiButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    marginRight: 10,
  },
  messageActionSheetEmojiText: {
    fontSize: 24,
  },
  messageActionSheetRow: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    alignItems: "center",
  },
  messageActionSheetRowText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  messageActionSheetCancelText: {
    fontSize: 16,
    color: "#DC2626",
    fontWeight: "600",
  },
});
