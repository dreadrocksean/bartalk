/**
 * Whether a trackee's device is actually still sharing.
 *
 * The feature cannot enforce anything on the device. A dependant who revokes
 * location permission in Settings, force-quits, or deletes the app simply stops
 * publishing, and no rule or flag can prevent that. What the design can do —
 * the same move the watch notification makes — is refuse to let it happen
 * quietly. Evasion is not blocked; it is made visible.
 *
 * It has to be mirrored onto the link, rather than read from the position
 * itself, because firestore.rules deliberately keeps a position unreadable
 * without an open watch session. A tracker must be able to learn *that* someone
 * stopped sharing without being able to see *where* they were — those are
 * different questions and only one of them is anyone's business.
 *
 * And it is mirrored here, on the server, rather than written by the app,
 * because the app is only running some of the time. Most position writes come
 * from a headless background task with no React state to hang a timer on, so a
 * client-side heartbeat would go stale while the device was publishing
 * perfectly well — reporting evasion that never happened.
 *
 * What this does not do is survive a modified client, which could write a fresh
 * position it never took. That is fine: it is aimed at the ordinary ways
 * sharing stops, which are the ones that actually happen.
 */

import * as functions from "firebase-functions/v1";
import {runWith} from "firebase-functions/v1";

import {db} from "./admin";

/**
 * Don't rewrite the link for every fix. Live publishing runs every five
 * seconds, and the guardian's screen cannot tell the difference between a
 * position from now and one from thirty seconds ago.
 */
const HEALTH_WRITE_THROTTLE_MS = 60_000;

export const onLocationWrite = runWith({maxInstances: 10})
  .firestore
  .document("locations/{userId}")
  .onWrite(
    async (
      change: functions.Change<functions.firestore.DocumentSnapshot>,
      context: functions.EventContext,
    ) => {
      const after = change.after.exists ? change.after.data() : null;
      if (!after) {
        return null;
      }

      const userId = context.params.userId as string;

      // A position document exists from the moment a link is accepted, holding
      // only who may read it. Without coordinates there has been no publish,
      // and stamping "last published: now" onto that would report healthy
      // sharing for a device that has never shared anything — the precise lie
      // this mechanism exists to prevent. Permission still gets through,
      // because "their location is off" is the useful half.
      const hasPosition =
        typeof after.lat === "number" &&
        Number.isFinite(after.lat) &&
        typeof after.lng === "number" &&
        Number.isFinite(after.lng);
      const publishedAt =
        typeof after.capturedAt === "number" ? after.capturedAt : Date.now();
      const permissionState =
        typeof after.permissionState === "string" ?
          after.permissionState :
          "unknown";

      const links = await db
        .collection("trackingLinks")
        .where("trackeeId", "==", userId)
        .where("status", "==", "active")
        .get();

      if (links.empty) {
        return null;
      }

      const batch = db.batch();
      let writes = 0;

      links.docs.forEach((doc) => {
        const data = doc.data();
        const storedAt =
          typeof data.trackeeLastPublishedAt === "number" ?
            data.trackeeLastPublishedAt :
            0;
        const storedPermission = data.trackeePermissionState;

        // A permission change is never throttled: losing location
        // access is the single most useful thing this mechanism
        // reports, and a minute of saying otherwise is a minute of
        // saying something untrue.
        const permissionChanged = storedPermission !== permissionState;
        if (!hasPosition && !permissionChanged) {
          return;
        }
        if (!permissionChanged &&
            publishedAt - storedAt < HEALTH_WRITE_THROTTLE_MS) {
          return;
        }

        batch.update(
          doc.ref,
          hasPosition ?
            {
              trackeeLastPublishedAt: publishedAt,
              trackeePermissionState: permissionState,
            } :
            {trackeePermissionState: permissionState},
        );
        writes += 1;
      });

      if (writes === 0) {
        return null;
      }

      await batch.commit();
      return null;
    },
  );
