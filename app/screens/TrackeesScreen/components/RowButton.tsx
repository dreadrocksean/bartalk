import { Pressable, Text, View } from "react-native";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import { Colors } from "../../../../constants/theme";
import styles from "../styles";

type RowButtonProps = {
  label: string;
  icon?: Parameters<typeof IconSymbol>[0]["name"];
  variant?: "default" | "primary" | "danger";
  /** Unread count. Omitted or zero renders nothing. */
  badgeCount?: number;
  onPress: () => void;
  accessibilityHint?: string;
};

export const RowButton = ({
  label,
  icon,
  variant = "default",
  badgeCount = 0,
  onPress,
  accessibilityHint,
}: RowButtonProps) => {
  const isPrimary = variant === "primary";
  const tint = isPrimary
    ? "#fff"
    : variant === "danger"
      ? "#B00020"
      : Colors.light.text;

  const hasBadge = badgeCount > 0;
  // Past a hundred the exact figure stops being information and starts being
  // a wide button.
  const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);

  return (
    <Pressable
      style={[styles.actionButton, isPrimary && styles.actionButtonPrimary]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        hasBadge
          ? `${label}, ${badgeCount} unread ${
              badgeCount === 1 ? "message" : "messages"
            }`
          : label
      }
      accessibilityHint={accessibilityHint}
    >
      {icon ? <IconSymbol name={icon} size={14} color={tint} /> : null}
      <Text
        style={[
          styles.actionButtonText,
          isPrimary && styles.actionButtonTextPrimary,
          variant === "danger" && styles.actionButtonTextDanger,
        ]}
      >
        {label}
      </Text>
      {hasBadge ? (
        <View style={styles.actionBadge}>
          <Text style={styles.actionBadgeText} numberOfLines={1}>
            {badgeLabel}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};
