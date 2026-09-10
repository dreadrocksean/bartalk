import { Text, View } from "react-native";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import styles from "../styles";

/**
 * The look has a ceiling, and the tracker is told about it before it arrives
 * rather than having the map go blank on them.
 *
 * There is deliberately no "extend" button here. Continuing to look is allowed,
 * but it has to be a new decision after this one ends — and that new decision
 * tells the other person again. A button that quietly bought another minute
 * would put the ceiling back where it started.
 */
export const WatchExpiryChip = ({
  secondsRemaining,
}: {
  secondsRemaining: number;
}) => (
  <View style={styles.expiryChip}>
    <IconSymbol name="timer" size={15} color="#8A4B00" />
    <Text style={styles.expiryChipText}>
      {`This look ends in ${secondsRemaining}s`}
    </Text>
  </View>
);
