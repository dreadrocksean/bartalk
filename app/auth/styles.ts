import { StyleSheet } from "react-native";
import { unity } from "../utils/general";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e5e5ea",
  },
  title: { fontSize: unity * 28, fontWeight: "bold", marginBottom: unity * 24 },
  input: {
    width: unity * 260,
    height: unity * 44,
    borderWidth: unity * 1,
    borderColor: "#ccc",
    borderRadius: unity * 8,
    marginBottom: unity * 16,
    paddingHorizontal: unity * 12,
    backgroundColor: "#fff",
  },
  helperText: {
    width: unity * 260,
    marginTop: unity * -4,
    marginBottom: unity * 16,
    color: "#6b7280",
    fontSize: unity * 12,
    textAlign: "center",
  },
  switchText: { marginTop: unity * 18, color: "#007AFF", fontSize: unity * 16 },
});

export default styles;
