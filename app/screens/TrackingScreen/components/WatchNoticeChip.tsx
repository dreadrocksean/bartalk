import { Text, View } from "react-native";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import styles from "../styles";

/**
 * Deliberately not dismissible. The whole point of the feature is that looking
 * is a visible act, and that only works if the person looking is reminded of it
 * for as long as they look.
 */
export const WatchNoticeChip = ({ names }: { names: string[] }) => {
  if (names.length === 0) return null;

  const subject =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]} and ${names.length - 1} others`;

  return (
    <View style={styles.noticeChip}>
      <IconSymbol name="eye.fill" size={15} color="#fff" />
      <Text style={styles.noticeChipText} numberOfLines={2}>
        {`${subject} ${names.length === 1 ? "knows" : "know"} you're looking`}
      </Text>
    </View>
  );
};
