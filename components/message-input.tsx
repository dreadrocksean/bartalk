import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export type MessageInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
};

export function MessageInput({
  value,
  onChangeText,
  onSend,
  placeholder,
}: MessageInputProps) {
  return (
    <View style={styles.inputBar}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || "iMessage"}
        placeholderTextColor="#aaa"
        onSubmitEditing={onSend}
        returnKeyType="send"
      />
      <TouchableOpacity onPress={onSend} style={styles.sendBtn}>
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
          Send
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
