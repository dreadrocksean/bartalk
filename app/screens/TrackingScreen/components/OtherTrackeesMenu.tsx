import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import { Colors } from "../../../../constants/theme";
import styles from "../styles";

export type TrackeeOption = {
  trackeeId: string;
  name: string;
  paused: boolean;
};

type OtherTrackeesMenuProps = {
  options: TrackeeOption[];
  onSelect: (option: TrackeeOption) => void;
};

/**
 * Adds another person to the map. Each pick is one deliberate tap that notifies
 * exactly one person, which is why the map is never populated automatically —
 * a notification nobody chose to trigger teaches the trackee to ignore it.
 */
export const OtherTrackeesMenu = ({
  options,
  onSelect,
}: OtherTrackeesMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (options.length === 0) return null;

  return (
    <View>
      <Pressable
        style={styles.dropdownAnchor}
        onPress={() => setIsOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        <IconSymbol name="person.badge.plus" size={15} color={Colors.light.text} />
        <Text style={styles.dropdownAnchorText}>
          {`Other trackees (${options.length})`}
        </Text>
        <IconSymbol
          name={isOpen ? "chevron.up" : "chevron.down"}
          size={14}
          color={Colors.light.icon}
        />
      </Pressable>

      {isOpen ? (
        <View style={styles.dropdownSheet}>
          <Text style={styles.dropdownHint}>
            Adding someone shows them on the map and tells them you&apos;re
            looking.
          </Text>
          {options.map((option, index) => (
            <View key={option.trackeeId}>
              {index > 0 ? <View style={styles.dropdownDivider} /> : null}
              <Pressable
                style={[
                  styles.dropdownRow,
                  option.paused && styles.dropdownRowDisabled,
                ]}
                disabled={option.paused}
                onPress={() => {
                  setIsOpen(false);
                  onSelect(option);
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: option.paused }}
                accessibilityLabel={
                  option.paused
                    ? `${option.name} has paused sharing`
                    : `Track ${option.name}. Notifies them.`
                }
              >
                <IconSymbol
                  name="iphone"
                  size={17}
                  color={option.paused ? Colors.light.icon : Colors.light.tint}
                />
                <Text style={styles.dropdownRowText} numberOfLines={1}>
                  {option.name}
                </Text>
                <Text style={styles.dropdownRowMeta}>
                  {option.paused ? "paused" : "notifies"}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};
