import * as AppleAuthentication from "expo-apple-authentication";
import { Image, StyleSheet, Text, TouchableOpacity } from "react-native";

export function GoogleSignInButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.googleBtn, disabled && styles.googleBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Image
        source={{
          uri: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png",
        }}
        style={[styles.googleIcon, disabled && styles.googleIconDisabled]}
      />
      <Text style={[styles.googleText, disabled && styles.googleTextDisabled]}>
        Sign in with Google
      </Text>
    </TouchableOpacity>
  );
}

export function AppleSignInButton({ onPress }: { onPress: () => void }) {
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={8}
      style={styles.appleBtn}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    width: 260,
    justifyContent: "center",
  },
  googleIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  googleIconDisabled: {
    opacity: 0.5,
  },
  googleText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  googleTextDisabled: {
    color: "#777",
  },
  googleBtnDisabled: {
    backgroundColor: "#f3f3f3",
  },
  appleBtn: {
    width: 260,
    height: 44,
    marginBottom: 12,
  },
});
