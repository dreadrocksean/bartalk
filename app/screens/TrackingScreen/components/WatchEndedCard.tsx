import { Pressable, Text, View } from "react-native";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import type { ExpiredWatch } from "../../../../tracking/tracking-provider";
import styles from "../styles";

/**
 * What the map says once a look has run out. The pin is gone because the
 * database has stopped serving that position, not because the app chose to hide
 * it — so this explains rather than apologises.
 *
 * Looking again is one tap away on purpose. Frequency was never the thing being
 * limited; silence was. Each tap opens a new session, and every new session
 * tells the other person.
 */
export const WatchEndedCard = ({
  expired,
  onResume,
}: {
  expired: ExpiredWatch[];
  onResume: (watch: ExpiredWatch) => void;
}) => {
  if (expired.length === 0) return null;

  return (
    <View style={styles.endedCard}>
      <View style={styles.endedHeader}>
        <IconSymbol name="eye.slash.fill" size={15} color="#5A6472" />
        <Text style={styles.endedTitle}>
          {expired.length === 1 ? "Look ended" : "Looks ended"}
        </Text>
      </View>
      {expired.map((watch) => (
        <View key={watch.trackeeId} style={styles.endedRow}>
          <Text style={styles.endedName} numberOfLines={1}>
            {watch.trackeeName}
          </Text>
          <Pressable
            style={styles.resumeButton}
            onPress={() => onResume(watch)}
            accessibilityRole="button"
            accessibilityLabel={`Look at ${watch.trackeeName} again`}
            accessibilityHint="Starts a new look and tells them again"
          >
            <Text style={styles.resumeButtonText}>Look again</Text>
          </Pressable>
        </View>
      ))}
      <Text style={styles.endedFootnote}>
        They were told it ended. Looking again tells them again.
      </Text>
    </View>
  );
};
