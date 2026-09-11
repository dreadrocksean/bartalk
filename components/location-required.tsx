import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useLocationGate } from "@/hooks/use-location-gate";
import { requestTrackingPermissions } from "@/tracking/permissions";
import { unity } from "@/app/utils/general";

/**
 * The screen a dependant cannot get past without sharing their location.
 *
 * It is deliberately not dismissible, and deliberately not a trick: it says who
 * can see them, that they agreed to this, and that they can ask to be released.
 * A block that hid the way out would be the version of this feature that gets
 * used against people.
 *
 * "Always" rather than "While Using" because a dependant whose position only
 * updates when they happen to have the app open is not really sharing at all —
 * their guardian would see a pin from hours ago and read it as current.
 */
export const LocationRequired = () => {
  const { isBlocked, permission, canAskAgain, refresh } = useLocationGate();

  if (!isBlocked) return null;

  // Once iOS has been refused, asking again does nothing at all — the dialog
  // never appears a second time. Sending them to Settings is the only honest
  // next step, so the button says so rather than pretending to ask.
  const mustUseSettings = !canAskAgain && permission === "denied";

  const onPress = async () => {
    if (mustUseSettings) {
      await Linking.openSettings().catch(() => {});
      return;
    }
    await requestTrackingPermissions().catch(() => {});
    refresh();
    // Android sends people to a Settings page that resolves before they choose.
    if (AppState.currentState === "active") refresh();
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>Location sharing is required</Text>

        <Text style={styles.body}>
          Someone is your guardian in BarTalk, and location sharing is part of
          that arrangement. You agreed to it when you entered their code.
        </Text>

        <View style={styles.steps}>
          <Text style={styles.step}>
            {Platform.OS === "ios"
              ? "Choose Allow While Using App, then Change to Always Allow when iOS asks."
              : "Choose Allow all the time."}
          </Text>
          <Text style={styles.stepMuted}>
            {permission === "whenInUse"
              ? "You've allowed it while the app is open. It needs Always, or your position stops updating the moment you close BarTalk."
              : "Nothing is shared until you allow this."}
          </Text>
        </View>

        <Pressable
          style={styles.button}
          onPress={onPress}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {mustUseSettings ? "Open Settings" : "Allow location access"}
          </Text>
        </Pressable>

        <Text style={styles.footnote}>
          You&apos;re told every time your guardian checks where you are, every
          check is recorded permanently, and you can ask to be released at any
          time from the Track tab.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,12,14,0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: unity * 24,
  },
  card: {
    backgroundColor: Colors.light.background,
    borderRadius: unity * 18,
    padding: unity * 22,
    gap: unity * 14,
    width: "100%",
    maxWidth: unity * 420,
  },
  title: {
    fontSize: unity * 21,
    fontWeight: "800",
    color: Colors.light.text,
  },
  body: {
    fontSize: unity * 15,
    lineHeight: unity * 21,
    color: Colors.light.text,
  },
  steps: {
    backgroundColor: "#FFF1DB",
    borderRadius: unity * 12,
    borderWidth: unity * 1,
    borderColor: "#E8C48B",
    padding: unity * 14,
    gap: unity * 7,
  },
  step: {
    fontSize: unity * 14,
    lineHeight: unity * 19,
    fontWeight: "600",
    color: "#5A3B0A",
  },
  stepMuted: {
    fontSize: unity * 13,
    lineHeight: unity * 18,
    color: "#5A3B0A",
  },
  button: {
    backgroundColor: Colors.light.tint,
    borderRadius: unity * 14,
    paddingVertical: unity * 15,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: unity * 16, fontWeight: "700" },
  footnote: {
    fontSize: unity * 12,
    lineHeight: unity * 17,
    color: Colors.light.icon,
  },
});
