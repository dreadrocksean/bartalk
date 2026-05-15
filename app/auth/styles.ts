import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e5e5ea",
  },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 24 },
  input: {
    width: 260,
    height: 44,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  helperText: {
    width: 260,
    marginTop: -4,
    marginBottom: 16,
    color: "#6b7280",
    fontSize: 12,
    textAlign: "center",
  },
  switchText: { marginTop: 18, color: "#007AFF", fontSize: 16 },
});

export default styles;
