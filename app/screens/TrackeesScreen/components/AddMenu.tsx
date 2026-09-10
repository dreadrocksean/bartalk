import { Modal, Pressable, Text, View } from "react-native";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import { Colors } from "../../../../constants/theme";
import styles from "../styles";

/**
 * The three ways a link can begin, kept apart on purpose.
 *
 * Asking a friend and taking on a dependant are different acts with different
 * consequences for the other person, and a single "Add" that quietly did either
 * would be how someone ends up a dependant by accident.
 */
export const AddMenu = ({
  visible,
  onClose,
  onAskFriend,
  onAddDependant,
  onEnterCode,
}: {
  visible: boolean;
  onClose: () => void;
  onAskFriend: () => void;
  onAddDependant: () => void;
  onEnterCode: () => void;
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <Pressable style={styles.modalBackdrop} onPress={onClose}>
      <Pressable style={styles.menuSheet} onPress={() => {}}>
        <View style={styles.modalHandle} />

        <Pressable
          style={styles.menuItem}
          onPress={onAskFriend}
          accessibilityRole="button"
        >
          <IconSymbol
            name="person.badge.plus"
            size={20}
            color={Colors.light.tint}
          />
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Ask a friend to share</Text>
            <Text style={styles.menuItemBody}>
              They accept, and can pause or stop whenever they like.
            </Text>
          </View>
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable
          style={styles.menuItem}
          onPress={onAddDependant}
          accessibilityRole="button"
        >
          <IconSymbol name="iphone" size={20} color={Colors.light.tint} />
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Add a dependant</Text>
            <Text style={styles.menuItemBody}>
              They can&apos;t stop sharing with you. Needs their phone, here,
              now.
            </Text>
          </View>
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable
          style={styles.menuItem}
          onPress={onEnterCode}
          accessibilityRole="button"
        >
          <IconSymbol name="checkmark" size={20} color={Colors.light.tint} />
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>I was given a code</Text>
            <Text style={styles.menuItemBody}>
              Someone wants to become your guardian.
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Pressable>
  </Modal>
);
