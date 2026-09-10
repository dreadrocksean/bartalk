import { Pressable, Text } from "react-native";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import { Colors } from "../../../../constants/theme";
import styles from "../styles";

type RowButtonProps = {
  label: string;
  icon?: Parameters<typeof IconSymbol>[0]["name"];
  variant?: "default" | "primary" | "danger";
  onPress: () => void;
  accessibilityHint?: string;
};

export const RowButton = ({
  label,
  icon,
  variant = "default",
  onPress,
  accessibilityHint,
}: RowButtonProps) => {
  const isPrimary = variant === "primary";
  const tint = isPrimary
    ? "#fff"
    : variant === "danger"
      ? "#B00020"
      : Colors.light.text;

  return (
    <Pressable
      style={[styles.actionButton, isPrimary && styles.actionButtonPrimary]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
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
    </Pressable>
  );
};
