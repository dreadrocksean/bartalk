import { Alert, Pressable, Text, View } from "react-native";

import { ThemedText } from "../../../../components/themed-text";
import { IconSymbol } from "../../../../components/ui/icon-symbol";
import type { TrackingLinkDoc } from "../../../types/tracking";
import { initialsOf } from "../../../../tracking/format";
import styles from "../styles";

const hoursUntil = (at: number) =>
  Math.max(1, Math.round((at - Date.now()) / 3_600_000));

/**
 * A guardian, as seen by the person they can watch.
 *
 * There is no Pause and no Stop here, and the row says so in words rather than
 * just omitting the buttons — someone should never have to work out from a
 * missing control that they no longer have one. The arrangement is stated
 * plainly and permanently, because a supervision people can forget about is
 * indistinguishable from one that was hidden from them.
 *
 * What remains is the exit, and it is never presented as a request the guardian
 * approves: it is a countdown that runs on its own.
 */
export const GuardianRow = ({
  link,
  onRequestRelease,
}: {
  link: TrackingLinkDoc;
  onRequestRelease: (link: TrackingLinkDoc) => void;
}) => {
  const pending =
    typeof link.releaseEffectiveAt === "number" && link.releaseEffectiveAt > 0;

  const confirm = () => {
    Alert.alert(
      "Ask to be released?",
      `${link.trackerName} will be told straight away. If nothing changes, ` +
        "the link ends on its own in a day.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Ask to be released",
          style: "destructive",
          onPress: () => onRequestRelease(link),
        },
      ],
    );
  };

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>
            {initialsOf(link.trackerName)}
          </ThemedText>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>
            {link.trackerName}
          </Text>
          <Text style={styles.guardianStatus}>Your guardian</Text>
        </View>
        {pending ? null : (
          <Pressable
            style={styles.releaseButton}
            onPress={confirm}
            accessibilityRole="button"
            accessibilityLabel={`Ask ${link.trackerName} to release you`}
          >
            <Text style={styles.releaseButtonText}>Ask to be released</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.guardianNotice}>
        <IconSymbol name="eye.fill" size={13} color="#8A4B00" />
        <Text style={styles.guardianNoticeText}>
          {link.trackerName} can see where you are, and you can&apos;t turn this
          off. You&apos;re told every time they look.
        </Text>
      </View>

      {pending ? (
        <View style={styles.releasePending}>
          <Text style={styles.releasePendingText}>
            {`You asked to be released. ${link.trackerName} was told. ` +
              `This ends in about ${hoursUntil(link.releaseEffectiveAt as number)} hours.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
};
