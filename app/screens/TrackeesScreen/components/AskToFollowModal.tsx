import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";

import { IconSymbol } from "../../../../components/ui/icon-symbol";
import { Colors } from "../../../../constants/theme";
import { fetchTrackingContacts, type TrackingContact } from "../../../../tracking-api";
import { initialsOf } from "../../../../tracking/format";
import { ThemedText } from "../../../../components/themed-text";
import styles from "../styles";

type AskToFollowModalProps = {
  visible: boolean;
  currentUserId: string;
  /** People already linked or already asked, hidden from the list. */
  excludedIds: string[];
  onClose: () => void;
  onSelect: (contact: TrackingContact) => void;
};

export const AskToFollowModal = ({
  visible,
  currentUserId,
  excludedIds,
  onClose,
  onSelect,
}: AskToFollowModalProps) => {
  const [contacts, setContacts] = useState<TrackingContact[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    let isActive = true;
    setContacts(null);
    fetchTrackingContacts(currentUserId)
      .then((result) => {
        if (isActive) setContacts(result);
      })
      .catch(() => {
        if (isActive) setContacts([]);
      });
    return () => {
      isActive = false;
    };
  }, [currentUserId, visible]);

  const available = (contacts ?? []).filter(
    (contact) => !excludedIds.includes(contact.id),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Ask someone to share</Text>
          <Text style={styles.modalBody}>
            They choose whether to accept, and can pause or stop at any time.
            They&apos;ll also be told every time you check where they are.
          </Text>

          {contacts === null ? (
            <ActivityIndicator style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={available}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => onSelect(item)}
                  accessibilityRole="button"
                >
                  <View style={styles.avatar}>
                    <ThemedText style={styles.avatarText}>
                      {initialsOf(item.name)}
                    </ThemedText>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{item.name}</Text>
                  </View>
                  <IconSymbol
                    name="person.badge.plus"
                    size={18}
                    color={Colors.light.tint}
                  />
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyBody}>
                    Nobody left to ask — you&apos;re already linked with everyone
                    in your contacts.
                  </Text>
                </View>
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
