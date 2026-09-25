import { Text } from "react-native";
import { splitIntoLinkParts } from "../../../utils/linkify";
import { openLink } from "../../../utils/open-link";
import styles from "../styles";

type MessageTextProps = {
  text: string;
  isMe: boolean;
  /** Holding a link has to still reach the message's own action sheet. */
  onLongPress: () => void;
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
