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

/** Mirrors tracking/constants.ts on the client. */
const WATCH_NOTIFY_COOLDOWN_MS = 120_000;
const WATCH_SESSION_STALE_MS = 90_000;

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
  const notifiedAt =
    typeof session.notifiedAt === "number" ? session.notifiedAt : 0;

  // Backgrounding and reopening the map within the cooldown is one look, not
  // two. Without this the trackee learns to ignore the alerts, which defeats
  // the whole feature.
  if (now - notifiedAt < WATCH_NOTIFY_COOLDOWN_MS) {
    functions.logger.info("Watch notification suppressed by cooldown", {
      sessionId,
      sinceLastMs: now - notifiedAt,
    });
    return;
  }

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
        title: "👀 Location checked",
        body: `${trackerName} is looking at your location right now.`,
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

const recordCompletedWatch = async (
  sessionId: string,
  session: FirebaseFirestore.DocumentData,
): Promise<void> => {
  const startedAt =
    typeof session.startedAt === "number" ? session.startedAt : 0;
  if (startedAt === 0) {
    return;
  }
  const endedAt =
    typeof session.endedAt === "number" ? session.endedAt : Date.now();

  await db.collection("trackingEvents").add({
    trackeeId: session.trackeeId,
    trackerId: session.trackerId,
    trackerName: session.trackerName ?? "Someone",
    startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - startedAt),
  });
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

      if (wasActive && !isActive) {
        await recordCompletedWatch(sessionId, after);
      }

      return null;
    },
  );

/**
 * Closes sessions whose tracker stopped heartbeating — a force-quit, a crash,
 * or a dead network. Without this the trackee would keep seeing "someone is
 * watching you" for a tracker who has long gone, and the audit entry for that
 * look would never be written.
 */
export const reapStaleWatchSessions = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async () => {
    const cutoff = Date.now() - WATCH_SESSION_STALE_MS;
    const stale = await db
      .collection("watchSessions")
      .where("active", "==", true)
      .where("lastHeartbeatAt", "<", cutoff)
      .limit(REAPER_BATCH_LIMIT)
      .get();

    if (stale.empty) {
      return null;
    }

    const batch = db.batch();
    stale.docs.forEach((doc) => {
      const lastHeartbeatAt = doc.data().lastHeartbeatAt;
      batch.update(doc.ref, {
        active: false,
        // Credit the watch only up to the last proof of life.
        endedAt:
          typeof lastHeartbeatAt === "number" ? lastHeartbeatAt : cutoff,
      });
    });
    await batch.commit();

    functions.logger.info("Reaped stale watch sessions", {
      count: stale.size,
    });
    return null;
  });
