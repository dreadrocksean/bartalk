import * as WebBrowser from "expo-web-browser";
import { Alert, Linking, Text } from "react-native";
import { splitIntoLinkParts } from "../../../utils/linkify";
import styles from "../styles";

type MessageTextProps = {
  text: string;
  isMe: boolean;
  /** Holding a link has to still reach the message's own action sheet. */
  onLongPress: () => void;
};

const openLink = async (href: string) => {
  try {
    // Web pages open in place, which keeps the conversation a back-swipe away.
    // Mail and phone links have to leave for the app that handles them.
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

/** A message's text, with any URLs, addresses and numbers made tappable. */
export const MessageText = ({ text, isMe, onLongPress }: MessageTextProps) => {
  const parts = splitIntoLinkParts(text);

  return (
    <Text
      style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextOther]}
    >
      {parts.map((part, index) =>
        part.type === "link" ? (
          <Text
            key={`${part.href}-${index}`}
            style={[
              styles.messageLink,
              isMe ? styles.messageLinkMe : styles.messageLinkOther,
            ]}
            onPress={() => {
              void openLink(part.href);
            }}
            onLongPress={onLongPress}
            suppressHighlighting
          >
            {part.value}
          </Text>
        ) : (
          part.value
        ),
      )}
    </Text>
  );
};
