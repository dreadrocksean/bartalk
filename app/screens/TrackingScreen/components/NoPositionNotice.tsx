import { Text, View } from "react-native";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import styles from "../styles";

/**
 * What the map says when someone is being watched but has no pin.
 *
 * This state used to crash: a position document exists from the moment a link
 * is accepted, but carries no coordinates until the first fix — and if the
 * trackee's location is switched off, it never gets any. An empty map with no
 * explanation is only marginally better, because the obvious reading of it is
 * that the app is broken.
 */
export const NoPositionNotice = ({ reasons }: { reasons: string[] }) => {
  if (reasons.length === 0) return null;

  return (
    <View style={styles.missingCard}>
      {reasons.map((reason) => (
        <View key={reason} style={styles.missingRow}>
          <IconSymbol name="exclamationmark.triangle.fill" size={14} color="#8A4B00" />
          <Text style={styles.missingText}>{reason}</Text>
        </View>
      ))}
    </View>
  );
};
