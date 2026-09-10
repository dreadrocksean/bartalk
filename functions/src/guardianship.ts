/**
 * Establishing guardianship.
 *
 * A friend consents to being tracked; a dependant does not. That asymmetry is
 * dangerous to hand out cheaply — "dependant" is precisely the label a
 * controlling partner would reach for — so it cannot be self-asserted. A
 * tracker can never write a dependant link: firestore.rules lets clients create
 * friendships only, and these functions are the sole path to the other kind.
 *
 * Authority comes from possession of the dependant's phone, which is what Apple
 * Family Sharing and Google Family Link both use in the end. The guardian mints
 * a code on their own device and enters it on the dependant's, while signed in
 * as the dependant. The redeeming call therefore carries the dependant's own
 * auth — that is the evidence, and it cannot be produced remotely.
 */

import {randomInt} from "node:crypto";

import * as functions from "firebase-functions/v1";
import {runWith} from "firebase-functions/v1";

import {admin, db} from "./admin";
import {getUserPushTarget, sendExpoPush} from "./push";

const CODE_TTL_MS = 600_000;

/**
 * No I, O, 0 or 1 — the code is read aloud across a table and typed on someone
 * else's phone, and those four are where that goes wrong.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/**
 * Eight characters from a 32-symbol alphabet is a little over a trillion codes.
 * With a ten minute life and one live code per guardian, guessing one is not a
 * route in. Math.random would not do here — this decides who may watch a child
 * without their consent, so the draw is from the CSPRNG.
 *
 * @return {string} A fresh pairing code.
 */
const generateCode = (): string => {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
};

const nameOf = (data: FirebaseFirestore.DocumentData | undefined): string => {
  const first = typeof data?.fname === "string" ? data.fname : "";
  const last = typeof data?.lname === "string" ? data.lname : "";
  const name = `${first} ${last}`.trim();
  return name.length > 0 ? name : "Someone";
};

const linkIdFor = (trackerId: string, trackeeId: string) =>
  `${trackerId}__${trackeeId}`;

/**
 * Step one, on the guardian's own device: mint a code to carry across the
 * table.
 *
 * @return {Promise<{code: string, expiresAt: number}>} The code and its expiry.
 */
export const createPairingCode = runWith({maxInstances: 10})
  .https
  .onCall(async (_data: unknown, context: functions.https.CallableContext) => {
    const guardianId = context.auth?.uid;
    if (!guardianId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign in to add a dependant.",
      );
    }

    const guardian = await db.collection("Users").doc(guardianId).get();
    if (!guardian.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Your profile is incomplete.",
      );
    }

    // One live code per guardian: a drawer full of valid codes is a drawer
    // full of ways to become someone's guardian.
    const existing = await db
      .collection("pairingCodes")
      .where("guardianId", "==", guardianId)
      .where("usedAt", "==", null)
      .get();
    const batch = db.batch();
    existing.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    const now = Date.now();
    const code = generateCode();
    await db.collection("pairingCodes").doc(code).set({
      guardianId,
      guardianName: nameOf(guardian.data()),
      createdAt: now,
      expiresAt: now + CODE_TTL_MS,
      usedAt: null,
      usedBy: null,
    });

    functions.logger.info("Pairing code minted", {guardianId});
    return {code, expiresAt: now + CODE_TTL_MS};
  });

/**
 * Step two, on the dependant's device, signed in as the dependant.
 *
 * @param {object} data The call payload, carrying the code.
 * @param {functions.https.CallableContext} context Caller auth.
 * @return {Promise<{guardianName: string, linkId: string}>} Who now sees them.
 */
export const redeemPairingCode = runWith({maxInstances: 10})
  .https
  .onCall(async (
    data: {code?: unknown},
    context: functions.https.CallableContext,
  ) => {
    const dependantId = context.auth?.uid;
    if (!dependantId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign in on this device first.",
      );
    }

    const code = typeof data?.code === "string" ?
      data.code.trim().toUpperCase().replace(/[^A-Z2-9]/g, "") :
      "";
    if (code.length !== CODE_LENGTH) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "That code doesn't look right.",
      );
    }

    const linkId = await db.runTransaction(async (tx) => {
      const codeRef = db.collection("pairingCodes").doc(code);
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "That code has expired or was already used.",
        );
      }
      const codeData = codeSnap.data() ?? {};
      const expiresAt =
        typeof codeData.expiresAt === "number" ? codeData.expiresAt : 0;
      if (codeData.usedAt || Date.now() > expiresAt) {
        throw new functions.https.HttpsError(
          "not-found",
          "That code has expired or was already used.",
        );
      }

      const guardianId =
        typeof codeData.guardianId === "string" ? codeData.guardianId : "";
      if (guardianId === dependantId) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "You can't be your own guardian.",
        );
      }

      const [guardianSnap, dependantSnap] = await Promise.all([
        tx.get(db.collection("Users").doc(guardianId)),
        tx.get(db.collection("Users").doc(dependantId)),
      ]);

      const id = linkIdFor(guardianId, dependantId);
      const existing = await tx.get(db.collection("trackingLinks").doc(id));
      if (existing.exists && existing.data()?.kind === "dependant" &&
          existing.data()?.status === "active") {
        throw new functions.https.HttpsError(
          "already-exists",
          "They are already your guardian.",
        );
      }

      tx.set(db.collection("trackingLinks").doc(id), {
        trackerId: guardianId,
        trackeeId: dependantId,
        members: [guardianId, dependantId],
        trackerName: nameOf(guardianSnap.data()),
        trackeeName: nameOf(dependantSnap.data()),
        status: "active",
        kind: "dependant",
        pausedByTrackee: false,
        establishedAt: admin.firestore.FieldValue.serverTimestamp(),
        establishedVia: "pairing-code",
        releaseRequestedAt: null,
        releaseEffectiveAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});

      tx.update(codeRef, {usedAt: Date.now(), usedBy: dependantId});

      return id;
    });

    functions.logger.info("Guardianship established", {linkId});
    const guardianName = linkId.split("__")[0];
    return {linkId, guardianName};
  });

/**
 * A dependant asked to be let go, and the delay has run out.
 *
 * The exit exists because guardianship a person cannot leave is the shape this
 * feature takes when it is turned against someone. A parent who still needs the
 * link re-establishes it in the time it takes to hand over a phone.
 */
export const completeDependantReleases = functions.pubsub
  .schedule("every 60 minutes")
  .onRun(async () => {
    const due = await db
      .collection("trackingLinks")
      .where("status", "==", "active")
      .where("releaseEffectiveAt", "<=", Date.now())
      .limit(200)
      .get();

    if (due.empty) {
      return null;
    }

    const batch = db.batch();
    due.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: "revoked",
        releaseRequestedAt: null,
        releaseEffectiveAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    functions.logger.info("Completed dependant releases", {count: due.size});

    await Promise.all(due.docs.map(async (doc) => {
      const link = doc.data();
      const target = await getUserPushTarget(link.trackerId);
      if (!target) return;
      await sendExpoPush(
        {
          to: target.token,
          title: `${link.trackeeName ?? "Someone"} is no longer sharing`,
          body: "The release they asked for has taken effect.",
          sound: "default",
          channelId: "messages",
          priority: "high",
          data: {type: "dependant-released", linkId: doc.id},
        },
        {linkId: doc.id, kind: "dependant-released"},
      );
    }));

    return null;
  });
