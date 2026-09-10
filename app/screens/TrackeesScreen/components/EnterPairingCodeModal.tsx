import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { redeemPairingCode } from "../../../../tracking-api";
import styles from "../styles";

/**
 * Redeeming a code, on the dependant's own phone.
 *
 * This screen is the moment the arrangement is agreed, so it states it in full
 * before the button is available — what the guardian will be able to do, and
 * what this person keeps. Someone should never discover afterwards what they
 * agreed to here.
 */
export const EnterPairingCodeModal = ({
  visible,
  onClose,
  onLinked,
}: {
  visible: boolean;
  onClose: () => void;
  onLinked: (guardianName: string) => void;
}) => {
  const [code, setCode] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCode("");
      setError(null);
      setIsWorking(false);
    }
  }, [visible]);

  const cleaned = code.toUpperCase().replace(/[^A-Z2-9]/g, "");
  const isComplete = cleaned.length === 8;

  const submit = () => {
    setIsWorking(true);
    setError(null);
    redeemPairingCode(cleaned)
      .then((result) => {
        setIsWorking(false);
        onLinked(result.guardianName);
      })
      .catch((err: unknown) => {
        setIsWorking(false);
        setError(
          err instanceof Error ? err.message : "That code didn't work.",
        );
      });
  };

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
          <Text style={styles.modalTitle}>Enter a code</Text>
          <Text style={styles.modalBody}>
            Someone has given you a code to become your guardian. Read this
            before you type it in.
          </Text>

          <View style={styles.consentBox}>
            <Text style={styles.consentLine}>
              • They will be able to see where you are, and you won&apos;t be
              able to pause or stop it.
            </Text>
            <Text style={styles.consentLine}>
              • You will be told every single time they look, and every look
              ends after a minute.
            </Text>
            <Text style={styles.consentLine}>
              • Your history of who checked on you is permanent. Nobody can
              delete it, including them.
            </Text>
            <Text style={styles.consentLine}>
              • You can ask to be released at any time. It tells them, and takes
              effect a day later whatever they say.
            </Text>
          </View>

          <TextInput
            id="pairing-code"
            style={styles.codeInput}
            value={cleaned.replace(/(.{4})(.+)/, "$1-$2")}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="ABCD-2345"
            placeholderTextColor="#9AA0A6"
            maxLength={9}
            accessibilityLabel="Pairing code"
          />

          {error ? <Text style={styles.codeErrorText}>{error}</Text> : null}

          <Pressable
            style={[
              styles.consentButton,
              !isComplete && styles.consentButtonDisabled,
            ]}
            disabled={!isComplete || isWorking}
            onPress={submit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isComplete || isWorking }}
          >
            {isWorking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.consentButtonText}>
                I understand — link us
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
