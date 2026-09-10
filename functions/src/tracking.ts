/**
 * Device tracking: the notification that makes checking someone's location a
 * visible act, and the audit trail that makes it permanent.
 *
 * These are the parts a client must not be trusted with. The trackee is
 * notified from the server the instant a watch session opens, and the history
 * of who looked is written with the Admin SDK, so no device — the tracker's or
 * the trackee's — can suppress, forge or erase it.
 */

import * as functions from "firebase-functions/v1";
import {runWith} from "firebase-functions/v1";

import {db} from "./admin";
import {getUserPushTarget, sendExpoPush} from "./push";

/** Mirrors tracking/constants.ts on the client, and watchCeilingMs() in
 * firestore.rules. All three must move together. */
const WATCH_SESSION_MAX_MS = 60_000;

/** Mirrors WATCH_HEARTBEAT_MS on the client. The resolution of "still here". */
const WATCH_HEARTBEAT_MS = 20_000;

/**
 * There is no notification cooldown. Every session that opens notifies, every
 * session that closes notifies, and sessions cannot exceed the ceiling above.
 * A cooldown made sense while a look was unbounded; once looks are finite it
 * becomes the thing a determined tracker hides inside, by reopening the map
 * just often enough to stay under it.
 */

/**
 * Apple advises no more than two or three background pushes per hour, and a
 * device woken too often simply stops being woken. The visible notice is the
 * contract; this is only an optimisation on top of it.
 */
const WAKE_PUSH_COOLDOWN_MS = 1_200_000;

const REAPER_BATCH_LIMIT = 400;

const notifyTrackee = async (
  sessionId: string,
  session: FirebaseFirestore.DocumentData,
): Promise<void> => {
  const trackeeId =
    typeof session.trackeeId === "string" ? session.trackeeId.trim() : "";
  const trackerId =
    typeof session.trackerId === "string" ? session.trackerId.trim() : "";
  if (trackeeId.length === 0 || trackerId.length === 0) {
    functions.logger.warn("Watch session missing participants", {sessionId});
    return;
  }

  const now = Date.now();

  const trackerName =
    typeof session.trackerName === "string" && session.trackerName.length > 0 ?
      session.trackerName :
      "Someone";

  const target = await getUserPushTarget(trackeeId);
  const updates: Record<string, number> = {notifiedAt: now};

  if (target) {
    await sendExpoPush(
      {
        to: target.token,
        // The name belongs in the title. A lock screen shows the title in
        // full and truncates the body, and "who" is the entire point of this
        // notification — a generic title makes the reader open the app to
        // learn the one fact they needed.
        title: `👀 ${trackerName} is checking your location`,
        body: "You'll be told when they stop. This look ends in " +
          `${Math.round(WATCH_SESSION_MAX_MS / 1000)} seconds.`,
        sound: "default",
        channelId: "messages",
        priority: "high",
        data: {
          type: "watch-started",
          sessionId,
          trackerId,
          trackerName,
        },
      },
      {sessionId, trackeeId},
    );

    const wakePushedAt =
      typeof session.wakePushedAt === "number" ? session.wakePushedAt : 0;

    if (now - wakePushedAt > WAKE_PUSH_COOLDOWN_MS) {
      // Headless wake: carries no title, body or channelId, or the push
      // service would render it as a second visible notification.
      await sendExpoPush(
        {
          to: target.token,
          contentAvailable: true,
          // Apple wants background pushes at normal priority; Android needs
          // high priority to survive doze.
          priority: target.platform === "ios" ? "normal" : "high",
          ttl: 60,
          data: {type: "location-wake", trackerId},
        },
        {sessionId, trackeeId, kind: "wake"},
      );
      updates.wakePushedAt = now;
    }
  } else {
    functions.logger.info("Trackee has no push token", {trackeeId, sessionId});
  }

  await db.collection("watchSessions").doc(sessionId).update(updates);
};

const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};

/**
 * The other half of the promise. Being told a look started, and never told it
 * stopped, leaves the trackee assuming they are still being watched — which is
 * both wrong and the exact anxiety this feature exists to remove. The duration
 * goes in the body because it is the fact worth keeping: not "someone looked",
 * but "someone looked for this long".
 *
 * @param {string} sessionId Id of the watch session that just closed.
 * @param {FirebaseFirestore.DocumentData} session The closed session document.
 * @param {number} durationMs How long the position was actually served for.
 * @return {Promise<void>} Resolves once the push has been handed to Expo.
 */
const notifyWatchEnded = async (
  sessionId: string,
  session: FirebaseFirestore.DocumentData,
  durationMs: number,
): Promise<void> => {
  const trackeeId =
    typeof session.trackeeId === "string" ? session.trackeeId.trim() : "";
  if (trackeeId.length === 0) {
    return;
  }

  const trackerName =
    typeof session.trackerName === "string" && session.trackerName.length > 0 ?
      session.trackerName :
      "Someone";

  const target = await getUserPushTarget(trackeeId);
  if (!target) {
    functions.logger.info("Trackee has no push token", {trackeeId, sessionId});
    return;
  }

  await sendExpoPush(
    {
      to: target.token,
      title: `${trackerName} stopped checking your location`,
      body: `They looked for ${formatDuration(durationMs)}.`,
      sound: "default",
      channelId: "messages",
      priority: "high",
      data: {
        type: "watch-ended",
        sessionId,
        trackerId: typeof session.trackerId === "string" ?
          session.trackerId :
          "",
        trackerName,
        durationMs: String(Math.max(0, Math.round(durationMs))),
      },
    },
    {sessionId, trackeeId, kind: "watch-ended"},
  );
};

const recordCompletedWatch = async (
  sessionId: string,
  session: FirebaseFirestore.DocumentData,
): Promise<number | null> => {
  const startedAt =
    typeof session.startedAt === "number" ? session.startedAt : 0;
  if (startedAt === 0) {
    return null;
  }
  const endedAt =
    typeof session.endedAt === "number" ? session.endedAt : Date.now();

  // A session can never have been served for longer than the ceiling, so the
  // audit entry must not claim it was — a reaper running a minute late would
  // otherwise write a two-minute look that the rules never actually allowed.
  const durationMs = Math.min(
    Math.max(0, endedAt - startedAt),
    WATCH_SESSION_MAX_MS,
  );

  await db.collection("trackingEvents").add({
    trackeeId: session.trackeeId,
    trackerId: session.trackerId,
    trackerName: session.trackerName ?? "Someone",
    startedAt,
    endedAt,
    durationMs,
  });

  return durationMs;
};

export const onWatchSessionWrite = runWith({maxInstances: 10})
  .firestore
  .document("watchSessions/{sessionId}")
  .onWrite(
    async (
      change: functions.Change<functions.firestore.DocumentSnapshot>,
      context: functions.EventContext,
    ) => {
      const sessionId = context.params.sessionId as string;
      const before = change.before.exists ? change.before.data() : null;
      const after = change.after.exists ? change.after.data() : null;
      if (!after) {
        return null;
      }

      const wasActive = before?.active === true;
      const isActive = after.active === true;

      if (!wasActive && isActive) {
        await notifyTrackee(sessionId, after);
        return null;
      }

      // A heartbeat on a session that has passed the ceiling closes it here,
      // rather than waiting for the reaper. The reaper is a one-minute cron, so
      // on its own it lets the *ending* notification drift up to a minute past
      // the moment the position actually stopped being served — long enough
      // that the trackee reasonably concludes it never came.
      //
      // This costs nothing: the function already runs on every heartbeat write
      // and until now did nothing with them. A tracker sitting on the map beats
      // every 20s, so the ending lands within 20s of the ceiling even for a
      // client that knows nothing about it. The reaper stays as the backstop
      // for the case this cannot cover — a tracker who stopped beating at all.
      if (wasActive && isActive) {
        const startedAt =
          typeof after.startedAt === "number" ? after.startedAt : 0;
        const now = Date.now();
        if (startedAt > 0 && now - startedAt >= WATCH_SESSION_MAX_MS) {
          functions.logger.info("Closing session at the ceiling", {
            sessionId,
            ageMs: now - startedAt,
          });
          await db.collection("watchSessions").doc(sessionId).update({
            active: false,
            // Clamped to at least startedAt. These two values are read from a
            // document that may have been rewritten between the trigger firing
            // and this write, and a session that ended before it began would
            // put a nonsense entry in a log nobody can delete.
            endedAt: Math.max(
              startedAt,
              Math.min(startedAt + WATCH_SESSION_MAX_MS, now),
            ),
          });
        }
        return null;
      }

      if (wasActive && !isActive) {
        const durationMs = await recordCompletedWatch(sessionId, after);
        if (durationMs !== null) {
          await notifyWatchEnded(sessionId, after, durationMs);
        }
      }

      return null;
    },
  );

/**
 * Pausing or revoking ends any look already in progress.
 *
 * The rules stop a *new* session being opened once sharing is paused, but a
 * session opened a moment earlier would otherwise stay active until the ceiling
 * caught it — leaving the trackee's banner saying they are being watched for up
 * to a minute after they pressed the button that was supposed to stop exactly
 * that. Pause has to take effect when it is pressed, or it isn't a control.
 *
 * Closing it here also writes the audit entry, so a look cut short by a pause
 * is recorded with the length it actually had.
 */
export const onTrackingLinkWrite = runWith({maxInstances: 10})
  .firestore
  .document("trackingLinks/{linkId}")
  .onWrite(
    async (
      change: functions.Change<functions.firestore.DocumentSnapshot>,
      context: functions.EventContext,
    ) => {
      const after = change.after.exists ? change.after.data() : null;
      if (!after) {
        return null;
      }

      // A dependant asking to be let go is the one message a guardian must not
      // miss, and it is deliberately impossible to suppress from the app.
      const before = change.before.exists ? change.before.data() : null;
      const askedNow =
        typeof after.releaseRequestedAt === "number" &&
        before?.releaseRequestedAt !== after.releaseRequestedAt;
      if (askedNow) {
        const effectiveAt =
          typeof after.releaseEffectiveAt === "number" ?
            after.releaseEffectiveAt :
            after.releaseRequestedAt + 172_800_000;
        const hours = Math.max(
          1,
          Math.round((effectiveAt - Date.now()) / 3_600_000),
        );
        const target = await getUserPushTarget(after.trackerId);
        if (target) {
          await sendExpoPush(
            {
              to: target.token,
              title: `${after.trackeeName ?? "Someone"} asked to stop sharing`,
              body: `This takes effect in about ${hours} hours unless you ` +
                "end it sooner. Talk to them.",
              sound: "default",
              channelId: "messages",
              priority: "high",
              data: {
                type: "release-requested",
                linkId: context.params.linkId as string,
              },
            },
            {linkId: context.params.linkId, kind: "release-requested"},
          );
        }
      }

      const stillSharing =
        after.status === "active" && after.pausedByTrackee !== true;
      if (stillSharing) {
        return null;
      }

      // Watch sessions and tracking links share an id, both being
      // `trackerId__trackeeId`.
      const sessionId = context.params.linkId as string;
      const sessionRef = db.collection("watchSessions").doc(sessionId);
      const session = await sessionRef.get();
      if (!session.exists || session.data()?.active !== true) {
        return null;
      }

      functions.logger.info("Ending watch session because sharing stopped", {
        sessionId,
        status: after.status,
        paused: after.pausedByTrackee === true,
      });

      const startedAt =
        typeof session.data()?.startedAt === "number" ?
          (session.data()?.startedAt as number) :
          Date.now();

      await sessionRef.update({
        active: false,
        endedAt: Math.max(
          startedAt,
          Math.min(startedAt + WATCH_SESSION_MAX_MS, Date.now()),
        ),
      });

      return null;
    },
  );

/**
 * Closes every session that has reached the ceiling, and with it every session
 * whose tracker stopped heartbeating — a force-quit, a crash, a dead network.
 * One query covers both now that no session may outlive the ceiling.
 *
 * The rules already stop serving positions at exactly the ceiling, so this is
 * not what enforces it. What this does is make the ending *visible*: it writes
 * the audit entry and fires the "no longer viewing" notification for trackers
 * whose app never got the chance to close the session politely.
 */
export const reapStaleWatchSessions = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async () => {
    const cutoff = Date.now() - WATCH_SESSION_MAX_MS;
    const expired = await db
      .collection("watchSessions")
      .where("active", "==", true)
      .where("startedAt", "<", cutoff)
      .limit(REAPER_BATCH_LIMIT)
      .get();

    if (expired.empty) {
      return null;
    }

    const batch = db.batch();
    expired.docs.forEach((doc) => {
      const data = doc.data();
      const startedAt =
        typeof data.startedAt === "number" ? data.startedAt : cutoff;
      const lastHeartbeatAt =
        typeof data.lastHeartbeatAt === "number" ?
          data.lastHeartbeatAt :
          startedAt;
      batch.update(doc.ref, {
        active: false,
        // A heartbeat proves the tracker was still looking at that moment, and
        // proves nothing about the interval after it — they may have watched
        // right up to the next one that never came. That uncertainty is
        // resolved in the trackee's favour: this is their record of being
        // looked at, and under-reporting it is the failure that matters.
        // Capped at the ceiling, which is the longest the position was served.
        endedAt: Math.min(
          startedAt + WATCH_SESSION_MAX_MS,
          lastHeartbeatAt + WATCH_HEARTBEAT_MS,
        ),
      });
    });
    await batch.commit();

    functions.logger.info("Reaped expired watch sessions", {
      count: expired.size,
    });
    return null;
  });
