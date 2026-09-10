import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";

import { createPairingCode } from "../../../../tracking-api";
import styles from "../styles";

/**
 * Minting the code that makes someone a dependant.
 *
 * The code is deliberately useless on its own: it has to be typed into the
 * other person's phone while signed in as them. That is the whole security
 * model — authority over someone comes from having their device in your hand,
 * not from anything you can claim about them from your own. It is also what
 * Family Sharing and Family Link settle on, for the same reason.
 *
 * The screen says plainly what the arrangement will be, because the person it
 * is about will be standing next to you reading it.
 */
export const AddDependantModal = ({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) => {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const expiresAtRef = useRef(0);

  const mint = useCallback(() => {
    setCode(null);
    setError(null);
    createPairingCode()
      .then((result) => {
        setCode(result.code);
        expiresAtRef.current = result.expiresAt;
        setSecondsLeft(Math.max(0, Math.round((result.expiresAt - Date.now()) / 1000)));
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Couldn't get a code."),
      );
  }, []);

  useEffect(() => {
    if (!visible) return;
    mint();
  }, [mint, visible]);

  useEffect(() => {
    if (!visible || !code) return;
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        Math.round((expiresAtRef.current - Date.now()) / 1000),
      );
      setSecondsLeft(left);
      if (left === 0) setCode(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [code, visible]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

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
          <Text style={styles.modalTitle}>Add a dependant</Text>
          <Text style={styles.modalBody}>
            A dependant can&apos;t pause or stop sharing with you the way a
            friend can. Because that&apos;s a lot of power, it can only be set
            up on their phone, with them there.
          </Text>

          {error ? (
            <View style={styles.codeErrorBox}>
              <Text style={styles.codeErrorText}>{error}</Text>
              <Pressable onPress={mint} accessibilityRole="button">
                <Text style={styles.codeRetry}>Try again</Text>
              </Pressable>
            </View>
          ) : code === null ? (
            <ActivityIndicator style={{ marginVertical: 32 }} />
          ) : (
            <>
              <View style={styles.codeBox}>
                <Text
                  style={styles.codeText}
                  accessibilityLabel={code.split("").join(" ")}
                >
                  {`${code.slice(0, 4)}-${code.slice(4)}`}
                </Text>
              </View>
              <Text style={styles.codeExpiry}>
                {secondsLeft > 0
                  ? `Expires in ${minutes}:${String(seconds).padStart(2, "0")}`
                  : "Expired"}
              </Text>

              <View style={styles.codeSteps}>
                <Text style={styles.codeStep}>
                  1. Open BarTalk on their phone, signed in as them.
                </Text>
                <Text style={styles.codeStep}>
                  2. On the Track tab, tap Add, then &ldquo;I was given a
                  code&rdquo;.
                </Text>
                <Text style={styles.codeStep}>3. Type this code in.</Text>
              </View>

              <Text style={styles.codeFootnote}>
                They&apos;ll still be told every time you check where they are,
                and they can always ask to be released — which tells you, and
                takes effect a day later.
              </Text>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
