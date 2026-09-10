import { type ReactNode } from "react";
import { Text, View } from "react-native";

import { ThemedText } from "../../../../components/themed-text";
import { initialsOf } from "../../../../tracking/format";
import styles from "../styles";

type PersonRowProps = {
  name: string;
  status: string;
  isWarning?: boolean;
  children?: ReactNode;
};

/**
 * Shared row shape for every list on this screen.
 *
 * Note what is deliberately absent: distance, coordinates, map thumbnails, or
 * how fresh someone's position is. A row that showed any of those would be
 * passive tracking with the notification designed out of it — the whole reason
 * the map is reached through an explicit Track button.
 */
export const PersonRow = ({
  name,
  status,
  isWarning = false,
  children,
}: PersonRowProps) => (
  <View style={styles.row}>
    <View style={styles.avatar}>
      <ThemedText style={styles.avatarText}>{initialsOf(name)}</ThemedText>
    </View>
    <View style={styles.rowInfo}>
      <Text style={styles.rowName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={isWarning ? styles.rowStatusWarn : styles.rowStatus}>
        {status}
      </Text>
    </View>
    {children}
  </View>
);
