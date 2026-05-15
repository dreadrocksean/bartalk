import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

export type MessageBubbleProps = {
  text: string;
  sender: "me" | "other";
  edited?: boolean;
  onLongPress?: () => void;
  isEditing?: boolean;
  children?: React.ReactNode;
};

export function MessageBubble({
  text,
  sender,
  edited,
  onLongPress,
  isEditing,
  children,
}: MessageBubbleProps) {
  return (
    <View
      style={[
        styles.bubble,
        sender === "me" ? styles.bubbleMe : styles.bubbleOther,
        isEditing && { opacity: 0.7 },
      ]}
      onTouchStart={onLongPress}
    >
      {children ? (
        children
      ) : (
        <>
          <Text
            style={[styles.bubbleText, sender === "me" && styles.bubbleTextMe]}
          >
            {text}
          </Text>
          {edited && <Text style={styles.edited}>(edited)</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    color: "#222",
    fontSize: 16,
    fontFamily: Platform.select({
      ios: "San Francisco",
      android: "Roboto",
      default: "Arial",
    }),
  },
  bubbleTextMe: {
    color: "#fff",
  },
  edited: {
    fontSize: 12,
    color: "#888",
    marginLeft: 6,
    alignSelf: "flex-end",
  },
});
