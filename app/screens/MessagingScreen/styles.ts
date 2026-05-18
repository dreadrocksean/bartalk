import { Platform, StyleSheet } from "react-native";
import { Colors } from "../../../constants/theme";
import { colorShade } from "../../utils/colorUtils";
import { unity } from "../../utils/general";

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: "#e5e5ea" },
  list: { padding: unity * 16, paddingBottom: unity * 140 },
  dayHeaderRow: {
    alignItems: "center",
    marginTop: unity * 2,
    marginBottom: unity * 10,
  },
  dayHeaderText: {
    fontSize: unity * 12,
    fontWeight: "600",
    color: "#6B7280",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: unity * 12,
    paddingHorizontal: unity * 10,
    paddingVertical: unity * 4,
    overflow: "hidden",
  },
  messageSwipeRow: {
    width: "100%",
    overflow: "visible",
  },
  messageSwipeRowMe: {
    alignItems: "flex-end",
  },
  messageSwipeRowOther: {
    alignItems: "flex-start",
  },
  messageSwipeable: {
    width: "100%",
    maxWidth: "100%",
    overflow: "visible",
  },
  messageSwipeChildren: {
    overflow: "visible",
  },
  messageTimestampReveal: {
    justifyContent: "flex-end",
    minWidth: unity * 104,
    paddingBottom: unity * 10,
  },
  messageTimestampRevealLeft: {
    alignItems: "flex-start",
    paddingLeft: unity * 4,
    paddingRight: unity * 10,
  },
  messageTimestampRevealRight: {
    alignItems: "flex-end",
    paddingLeft: unity * 10,
    paddingRight: unity * 4,
  },
  messageTimestampRevealText: {
    color: "#6B7280",
    fontSize: unity * 11,
    fontWeight: "500",
  },
  messageTimestampRevealTextLeft: {
    textAlign: "left",
  },
  messageTimestampRevealTextRight: {
    textAlign: "right",
  },
  bubble: {
    maxWidth: "80%",
    padding: unity * 12,
    borderRadius: unity * 22,
    marginBottom: unity * 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: unity * 4,
    shadowOffset: { width: unity * 0, height: unity * 2 },
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    overflow: "visible",
  },
  bubbleReactionOffset: {
    marginTop: unity * 10,
  },
  bubbleContent: {
    flexShrink: 1,
  },
  reactionBubbleRow: {
    position: "absolute",
    top: unity * -20,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  reactionBubbleRowMe: {
    left: unity * -12,
  },
  reactionBubbleRowOther: {
    right: unity * -12,
  },
  reactionBubble: {
    minHeight: unity * 22,
    minWidth: unity * 22,
    borderRadius: unity * 22,
    padding: unity * 6,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderWidth: unity * 1,
    borderColor: "#D1D5DB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: unity * 4,
    shadowOffset: { width: unity * 0, height: unity * 2 },
    marginRight: unity * 4,
  },
  reactionBubbleMe: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderColor: "#D1D5DB",
  },
  reactionBubbleOther: {
    backgroundColor: colorShade(Colors.light.bubbleMe, -10),
    borderColor: colorShade(Colors.light.bubbleMe, -20),
  },
  reactionBubbleEmoji: {
    fontSize: unity * 14,
    lineHeight: unity * 18,
  },
  reactionBubbleCount: {
    marginLeft: unity * 3,
    fontSize: unity * 11,
    lineHeight: unity * 12,
    color: "#374151",
    fontWeight: "600",
  },
  bubbleHighlighted: {
    borderWidth: unity * 1,
    borderColor: "#0A84FF",
    shadowOpacity: 0.2,
    shadowRadius: unity * 8,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: Colors.light.bubbleMe,
    borderBottomRightRadius: unity * 6,
  },
  bubbleMeGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: unity * 22,
    borderBottomRightRadius: unity * 6,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: Colors.light.bubbleOther,
    borderBottomLeftRadius: unity * 6,
  },
  bubbleText: {
    fontSize: unity * 16,
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
    fontSize: unity * 12,
    color: "#888",
    marginLeft: unity * 6,
    alignSelf: "flex-end",
  },
  messageImageWrapWithText: {
    marginTop: unity * 8,
  },
  messageImage: {
    width: unity * 220,
    borderRadius: unity * 14,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
  },
  replyQuote: {
    borderRadius: unity * 10,
    borderLeftWidth: unity * 3,
    paddingHorizontal: unity * 10,
    paddingVertical: unity * 6,
    marginBottom: unity * 8,
  },
  replyQuoteMe: {
    backgroundColor: "rgba(107, 68, 37, 0.14)",
    borderLeftColor: "#A56D3D",
  },
  replyQuoteOther: {
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    borderLeftColor: "#4B5563",
  },
  replyQuoteLabel: {
    fontSize: unity * 12,
    fontWeight: "600",
    marginBottom: unity * 2,
  },
  replyQuoteLabelMe: {
    color: "#5F371A",
  },
  replyQuoteLabelOther: {
    color: "#374151",
  },
  replyQuoteText: {
    fontSize: unity * 13,
  },
  replyQuoteTextMe: {
    color: "#4A2E18",
  },
  replyQuoteTextOther: {
    color: "#111827",
  },
  typingBubbleContainer: {
    alignSelf: "flex-start",
    marginTop: unity * 2,
    marginBottom: unity * 8,
  },
  typingBubble: {
    minWidth: unity * 58,
    paddingHorizontal: unity * 14,
    paddingVertical: unity * 10,
  },
  composerContainer: {
    borderTopWidth: unity * 1,
    borderColor: "#e5e5ea",
    backgroundColor: "#f9f9f9",
  },
  replyComposer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: unity * 12,
    paddingTop: unity * 8,
    paddingBottom: unity * 4,
  },
  replyComposerTextWrap: {
    flex: 1,
  },
  replyComposerLabel: {
    color: "#0A84FF",
    fontSize: unity * 12,
    fontWeight: "600",
  },
  replyComposerText: {
    color: "#4B5563",
    fontSize: unity * 13,
    marginTop: unity * 1,
  },
  replyComposerClose: {
    marginLeft: unity * 8,
    height: unity * 24,
    width: unity * 24,
    borderRadius: unity * 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  replyComposerCloseText: {
    color: "#4B5563",
    fontSize: unity * 14,
    fontWeight: "700",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: unity * 12,
    backgroundColor: "#f9f9f9",
  },
  attachBtn: {
    height: unity * 34,
    width: unity * 34,
    borderRadius: unity * 17,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: unity * 8,
  },
  attachBtnText: {
    color: "#374151",
    fontWeight: "700",
    fontSize: unity * 20,
    lineHeight: unity * 20,
    marginTop: unity * -2,
  },
  input: {
    flex: 1,
    height: unity * 40,
    borderRadius: unity * 20,
    backgroundColor: "#fff",
    paddingHorizontal: unity * 16,
    fontSize: unity * 16,
    marginRight: unity * 8,
    borderWidth: unity * 1,
    borderColor: "#e5e5ea",
  },
  pendingImageComposer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: unity * 12,
    paddingTop: unity * 8,
    paddingBottom: unity * 4,
  },
  pendingImageThumb: {
    width: unity * 44,
    height: unity * 44,
    borderRadius: unity * 10,
  },
  pendingImageMetaWrap: {
    flex: 1,
    marginLeft: unity * 10,
  },
  pendingImageMetaText: {
    color: "#374151",
    fontSize: unity * 13,
    fontWeight: "500",
  },
  pendingImageRemoveBtn: {
    marginLeft: unity * 10,
    width: unity * 24,
    height: unity * 24,
    borderRadius: unity * 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  pendingImageRemoveText: {
    color: "#4B5563",
    fontSize: unity * 14,
    fontWeight: "700",
  },
  editContainer: {
    width: "100%",
  },
  editInput: {
    width: "100%",
    minHeight: unity * 44,
    maxHeight: unity * 180,
    borderRadius: unity * 14,
    backgroundColor: "#fff",
    paddingHorizontal: unity * 12,
    paddingVertical: unity * 10,
    fontSize: unity * 16,
    lineHeight: unity * 22,
    borderWidth: unity * 1,
    borderColor: "#d1d5db",
    color: Colors.light.bubbleTextOther,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: unity * 8,
  },
  editCancelBtn: {
    borderRadius: unity * 16,
    paddingHorizontal: unity * 12,
    paddingVertical: unity * 6,
    marginRight: unity * 8,
    backgroundColor: "rgba(0, 0, 0, 0.07)",
  },
  editCancelText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: unity * 13,
  },
  sendBtn: {
    backgroundColor: "#007AFF",
    borderRadius: unity * 20,
    paddingHorizontal: unity * 18,
    paddingVertical: unity * 8,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  saveBtn: {
    backgroundColor: "#0A84FF",
    borderRadius: unity * 16,
    paddingHorizontal: unity * 12,
    paddingVertical: unity * 6,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: unity * 13,
  },
  imageViewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.86)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: unity * 20,
    paddingVertical: unity * 40,
  },
  imageViewerImage: {
    width: "100%",
    height: "100%",
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
    borderTopLeftRadius: unity * 18,
    borderTopRightRadius: unity * 18,
    paddingHorizontal: unity * 14,
    paddingTop: unity * 10,
    paddingBottom: unity * 24,
  },
  messageActionSheetEmojiScroll: {
    marginBottom: unity * 6,
  },
  messageActionSheetEmojiRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: unity * 8,
    paddingRight: unity * 6,
  },
  messageActionSheetEmojiButton: {
    width: unity * 46,
    height: unity * 46,
    borderRadius: unity * 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    marginRight: unity * 10,
  },
  messageActionSheetEmojiText: {
    fontSize: unity * 24,
  },
  messageActionSheetRow: {
    paddingVertical: unity * 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    alignItems: "center",
  },
  messageActionSheetRowText: {
    fontSize: unity * 16,
    color: "#111827",
    fontWeight: "500",
  },
  messageActionSheetCancelText: {
    fontSize: unity * 16,
    color: "#DC2626",
    fontWeight: "600",
  },
});
