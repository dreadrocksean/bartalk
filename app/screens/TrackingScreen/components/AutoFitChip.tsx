import { Pressable, Text } from "react-native";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import styles from "../styles";

type AutoFitChipProps = {
  secondsRemaining: number;
  bottom: number;
  onPress: () => void;
};

/**
 * Shown only while the user has taken manual control. The countdown exists so
 * the camera never appears to move on its own — a map that silently snaps back
 * feels broken, while one that says "recentring in 5" feels deliberate.
 */
export const AutoFitChip = ({
  secondsRemaining,
  bottom,
  onPress,
}: AutoFitChipProps) => (
  <Pressable
    style={[styles.autoFitChip, { bottom }]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`Recentre map now. Recentring automatically in ${secondsRemaining} seconds.`}
  >
    <IconSymbol name="arrow.clockwise" size={15} color="#fff" />
    <Text style={styles.autoFitChipText}>Recentre</Text>
    <Text style={styles.autoFitCountdown}>{secondsRemaining}s</Text>
  </Pressable>
);
