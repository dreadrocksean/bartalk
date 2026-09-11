import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconSymbol } from "../../../components/ui/icon-symbol";
import { useTrackingEvents } from "../../../hooks/use-tracking-events";
import { useUnreadCounts } from "../../../hooks/use-unread-counts";
import { useWatchScope } from "../../../hooks/use-watch-scope";
import {
  requestRelease,
  requestTrackingLink,
  respondToTrackingLink,
  revokeTrackingLink,
  setTrackingLinkPaused,
  type TrackingContact,
} from "../../../tracking-api";
import {
  describeSharing,
  formatAge,
  formatDuration,
} from "../../../tracking/format";
import { requestTrackingPermissions } from "../../../tracking/permissions";
import { useTracking } from "../../../tracking/tracking-provider";
import type { TrackingLinkDoc } from "../../types/tracking";
import { AskToFollowModal } from "./components/AskToFollowModal";
import { PersonRow } from "./components/PersonRow";
import { AddDependantModal } from "./components/AddDependantModal";
import { AddMenu } from "./components/AddMenu";
import { EnterPairingCodeModal } from "./components/EnterPairingCodeModal";
import { GuardianRow } from "./components/GuardianRow";
import { RowButton } from "./components/RowButton";
import styles from "./styles";

const TrackeesScreen = () => {
  const router = useRouter();
  const {
    userId,
    myName,
    trackees,
    trackers,
    incomingRequests,
    outgoingRequests,
  } = useTracking();
  const events = useTrackingEvents(userId);
  const { counts: unreadCounts } = useUnreadCounts(userId);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isDependantVisible, setIsDependantVisible] = useState(false);
  const [isCodeVisible, setIsCodeVisible] = useState(false);

  // Guardianship is a property of the link, so which side of it you are on
  // decides what you can do — not who you are.
  const isDependantLink = (link: TrackingLinkDoc) => link.kind === "dependant";
  const guardians = trackers.filter(isDependantLink);
  const friendTrackers = trackers.filter((link) => !isDependantLink(link));

  const handleRequestRelease = useCallback((link: TrackingLinkDoc) => {
    requestRelease(link.id).catch(() => {});
  }, []);

  // This screen shows nobody's position, so being here ends any open session —
  // stepping back from the map is stepping back from watching.
  useWatchScope("none");

  const handleAccept = useCallback(async (link: TrackingLinkDoc) => {
    await respondToTrackingLink({ linkId: link.id, accept: true }).catch(
      () => {},
    );
    const permission = await requestTrackingPermissions();
    if (permission === "denied") {
      Alert.alert(
        "Location is off",
        `${link.trackerName} won't see anything until you allow BarTalk to use your location.`,
      );
      return;
    }
    if (permission === "whenInUse") {
      Alert.alert(
        "Sharing while the app is open",
        `${link.trackerName} will only see you while BarTalk is open. Choose "Always" in Settings to share in the background.`,
      );
    }
  }, []);

  const handleDecline = useCallback((link: TrackingLinkDoc) => {
    respondToTrackingLink({ linkId: link.id, accept: false }).catch(() => {});
  }, []);

  const handleRevoke = useCallback((link: TrackingLinkDoc, who: string) => {
    Alert.alert(
      "Stop sharing?",
      `${who} will no longer be able to see where you are.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop sharing",
          style: "destructive",
          onPress: () => {
            revokeTrackingLink(link.id).catch(() => {});
          },
        },
      ],
    );
  }, []);

  const handleAsk = useCallback(
    (contact: TrackingContact) => {
      if (!userId) return;
      setIsPickerVisible(false);
      requestTrackingLink({
        trackerId: userId,
        trackerName: myName,
        trackeeId: contact.id,
        trackeeName: contact.name,
      }).catch(() => {});
    },
    [myName, userId],
  );

  const openChat = useCallback(
    (link: TrackingLinkDoc) => {
      router.push({
        pathname: "/screens/MessagingScreen",
        params: { contactId: link.trackeeId, contactName: link.trackeeName },
      });
    },
    [router],
  );

  const openMap = useCallback(
    (link: TrackingLinkDoc) => {
      router.push({
        pathname: "/screens/TrackingScreen",
        params: { trackeeId: link.trackeeId, trackeeName: link.trackeeName },
      });
    },
    [router],
  );

  const excludedIds = [
    ...trackees.map((link) => link.trackeeId),
    ...outgoingRequests.map((link) => link.trackeeId),
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Track</Text>
        <Pressable
          style={styles.headerAction}
          onPress={() => setIsMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add someone"
        >
          <IconSymbol name="person.badge.plus" size={15} color="#fff" />
          <Text style={styles.headerActionText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {incomingRequests.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Requests</Text>
            <View style={styles.card}>
              {incomingRequests.map((link, index) => (
                <View key={link.id}>
                  {index > 0 ? <View style={styles.rowDivider} /> : null}
                  <PersonRow
                    name={link.trackerName}
                    status="Wants to see your location"
                  >
                    <View style={styles.requestActions}>
                      <RowButton
                        label="Decline"
                        onPress={() => handleDecline(link)}
                      />
                      <RowButton
                        label="Accept"
                        variant="primary"
                        onPress={() => handleAccept(link)}
                      />
                    </View>
                  </PersonRow>
                  <Text style={styles.requestBody}>
                    You&apos;ll get a notification every single time
                    {` ${link.trackerName} `}
                    checks where you are. You can pause or stop at any time.
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>People I can see</Text>
        {trackees.length === 0 && outgoingRequests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nobody yet</Text>
            <Text style={styles.emptyBody}>
              Tap Ask to invite someone. They have to accept before you can see
              anything, and they&apos;re told each time you look.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {trackees.map((link, index) => (
              <View key={link.id}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <PersonRow
                  name={link.trackeeName}
                  // The row now reports whether they are actually publishing,
                  // mirrored onto the link by the server. It still cannot see
                  // where they are — that stays behind an open watch session —
                  // which is the distinction that makes this safe to show: that
                  // someone stopped sharing is the tracker's business, where
                  // they were is not.
                  status={describeSharing(link).text}
                  isWarning={describeSharing(link).isWarning}
                >
                  <View style={styles.rowButtons}>
                    <RowButton
                      label="Chat"
                      icon="bubble.left.and.bubble.right.fill"
                      badgeCount={unreadCounts[link.trackeeId] ?? 0}
                      onPress={() => openChat(link)}
                    />
                    <RowButton
                      label="Track"
                      icon="location.fill"
                      variant="primary"
                      disabled={link.pausedByTrackee}
                      onPress={() => openMap(link)}
                      accessibilityHint={
                        link.pausedByTrackee
                          ? `${link.trackeeName} has paused sharing, so there is nothing to see`
                          : `Opens the map and tells ${link.trackeeName} you're looking`
                      }
                    />
                  </View>
                </PersonRow>
              </View>
            ))}
            {outgoingRequests.map((link, index) => (
              <View key={link.id}>
                {(index > 0 || trackees.length > 0) ? (
                  <View style={styles.rowDivider} />
                ) : null}
                <PersonRow name={link.trackeeName} status="Waiting to accept">
                  <RowButton
                    label="Cancel"
                    variant="danger"
                    onPress={() => {
                      revokeTrackingLink(link.id).catch(() => {});
                    }}
                  />
                </PersonRow>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>People who can see me</Text>
        {trackers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>
              Nobody can see your location.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {guardians.map((link, index) => (
              <View key={link.id}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <GuardianRow
                  link={link}
                  onRequestRelease={handleRequestRelease}
                />
              </View>
            ))}
            {friendTrackers.map((link, index) => (
              <View key={link.id}>
                {(index > 0 || guardians.length > 0) ? (
                  <View style={styles.rowDivider} />
                ) : null}
                <PersonRow
                  name={link.trackerName}
                  status={
                    link.pausedByTrackee ? "Paused by you" : "Can see where you are"
                  }
                  isWarning={link.pausedByTrackee}
                >
                  <View style={styles.rowButtons}>
                    <RowButton
                      label={link.pausedByTrackee ? "Resume" : "Pause"}
                      icon={link.pausedByTrackee ? "play.fill" : "pause.fill"}
                      onPress={() => {
                        setTrackingLinkPaused({
                          linkId: link.id,
                          paused: !link.pausedByTrackee,
                        }).catch(() => {});
                      }}
                    />
                    <RowButton
                      label="Stop"
                      variant="danger"
                      onPress={() => handleRevoke(link, link.trackerName)}
                    />
                  </View>
                </PersonRow>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Who checked on me</Text>
        <Text style={styles.sectionNote}>
          Every check is recorded here. Nobody can delete these, including you.
        </Text>
        {events.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>Nobody has checked yet.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {events.map((event, index) => (
              <View key={event.id}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <View style={styles.historyRow}>
                  <IconSymbol name="eye.fill" size={16} color="#8a8f94" />
                  <Text style={styles.historyText} numberOfLines={1}>
                    {`${event.trackerName} checked your location`}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {`${formatAge(event.startedAt)} · ${formatDuration(event.durationMs)}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {userId ? (
        <>
          <AddMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onAskFriend={() => {
          setIsMenuVisible(false);
          setIsPickerVisible(true);
        }}
        onAddDependant={() => {
          setIsMenuVisible(false);
          setIsDependantVisible(true);
        }}
        onEnterCode={() => {
          setIsMenuVisible(false);
          setIsCodeVisible(true);
        }}
      />

      <AddDependantModal
        visible={isDependantVisible}
        onClose={() => setIsDependantVisible(false)}
      />

      <EnterPairingCodeModal
        visible={isCodeVisible}
        onClose={() => setIsCodeVisible(false)}
        onLinked={(guardianName) => {
          setIsCodeVisible(false);
          Alert.alert(
            "You're linked",
            `${guardianName} can now see where you are. You'll be told every ` +
              "time they look, and you can ask to be released at any time.",
          );
        }}
      />

      <AskToFollowModal
          visible={isPickerVisible}
          currentUserId={userId}
          excludedIds={excludedIds}
          onClose={() => setIsPickerVisible(false)}
            onSelect={handleAsk}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
};

export default TrackeesScreen;
