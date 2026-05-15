import { Platform, StyleSheet } from "react-native";
import { Colors } from "../../../constants/theme";

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: "#e5e5ea" },
  list: { padding: 16, paddingBottom: 80 },
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
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderTopWidth: 1,
    borderColor: "#e5e5ea",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
});
