import * as WebBrowser from "expo-web-browser";
import { Alert, Linking } from "react-native";

/**
 * Opens a link from a message. Web pages open in place, which keeps the
 * conversation a back-swipe away; mail and phone links have to hand off to
 * whichever app owns them.
 */
export const openLink = async (href: string) => {
  try {
    if (/^https?:/i.test(href)) {
      await WebBrowser.openBrowserAsync(href);
      return;
    }
    const canOpen = await Linking.canOpenURL(href);
    if (!canOpen) {
      Alert.alert("Nothing here can open that link.");
      return;
    }
    await Linking.openURL(href);
  } catch (error) {
    console.error("Failed to open link:", error);
    Alert.alert("Couldn't open that link.");
  }
};
