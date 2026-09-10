/**
 * Verifies the tracking security rules against the Firestore emulator.
 *
 * The property being checked is the one the whole feature rests on: a position
 * cannot be read without an open watch session, and opening a watch session is
 * what notifies the person being looked at. If these pass, the notification
 * cannot be skipped by a modified client or a direct API call.
 *
 * Usage:
 *   yarn verify-rules
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";

// RulesTestContext.firestore() returns a firebase/compat instance, so these
// shims keep the checks below reading like the modular app code.
const docRef = (db, collection, id) => db.collection(collection).doc(id);
const setDoc = (ref, data, options) =>
  options?.merge ? ref.set(data, { merge: true }) : ref.set(data);
const updateDoc = (ref, data) => ref.update(data);
const getDoc = (ref) => ref.get();

const PARENT = "parent-uid";
const TEEN = "teen-uid";
const STRANGER = "stranger-uid";
const LINK_ID = `${PARENT}__${TEEN}`;

const results = [];

const check = async (name, run) => {
  try {
    await run();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`  FAIL  ${name}\n          ${error?.message ?? error}`);
  }
};

const testEnv = await initializeTestEnvironment({
  projectId: "demo-bartalk",
  firestore: {
    host: "127.0.0.1",
    port: 8080,
    rules: readFileSync("firestore.rules", "utf8"),
  },
});

await testEnv.clearFirestore();

const parentDb = testEnv.authenticatedContext(PARENT).firestore();
const teenDb = testEnv.authenticatedContext(TEEN).firestore();
const strangerDb = testEnv.authenticatedContext(STRANGER).firestore();

console.log("\nConsent");

await check("a tracker may ask", () =>
  assertSucceeds(
    setDoc(docRef(parentDb, "trackingLinks", LINK_ID), {
      trackerId: PARENT,
      trackeeId: TEEN,
      members: [PARENT, TEEN],
      trackerName: "Parent",
      trackeeName: "Teen",
      status: "pending",
      pausedByTrackee: false,
    }),
  ),
);

await check("a tracker may NOT grant their own request", () =>
  assertFails(
    updateDoc(docRef(parentDb, "trackingLinks", LINK_ID), {
      status: "active",
    }),
  ),
);

await check("an unrelated user may not read the link", () =>
  assertFails(getDoc(docRef(strangerDb, "trackingLinks", LINK_ID))),
);

await check("the trackee may accept", () =>
  assertSucceeds(
    updateDoc(docRef(teenDb, "trackingLinks", LINK_ID), { status: "active" }),
  ),
);

console.log("\nPositions");

await testEnv.withSecurityRulesDisabled(async (context) => {
  await setDoc(docRef(context.firestore(), "locations", TEEN), {
    lat: 51.5,
    lng: -0.12,
    capturedAt: Date.now(),
    mode: "idle",
    sharedWith: [PARENT],
    permissionState: "always",
  });
});

await check("an approved tracker CANNOT read a position without watching", () =>
  assertFails(getDoc(docRef(parentDb, "locations", TEEN))),
);

await check("a stranger cannot read a position", () =>
  assertFails(getDoc(docRef(strangerDb, "locations", TEEN))),
);

await check("the trackee can always read their own position", () =>
  assertSucceeds(getDoc(docRef(teenDb, "locations", TEEN))),
);

await check("a tracker cannot write someone else's position", () =>
  assertFails(
    setDoc(docRef(parentDb, "locations", TEEN), { lat: 0, lng: 0 }),
  ),
);

console.log("\nWatch sessions");

await check("a tracker may not pre-set the notification cooldown", () =>
  assertFails(
    setDoc(docRef(parentDb, "watchSessions", LINK_ID), {
      trackerId: PARENT,
      trackeeId: TEEN,
      trackerName: "Parent",
      active: true,
      startedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
      // Writing this would make the server suppress the push to the trackee.
      notifiedAt: Date.now(),
    }),
  ),
);

await check("opening a watch session is allowed", () =>
  assertSucceeds(
    setDoc(docRef(parentDb, "watchSessions", LINK_ID), {
      trackerId: PARENT,
      trackeeId: TEEN,
      trackerName: "Parent",
      active: true,
      startedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
    }),
  ),
);

await check("...and only now is the position readable", () =>
  assertSucceeds(getDoc(docRef(parentDb, "locations", TEEN))),
);

await check("a watch inside the ceiling can heartbeat", () =>
  assertSucceeds(
    updateDoc(docRef(parentDb, "watchSessions", LINK_ID), {
      lastHeartbeatAt: Date.now(),
    }),
  ),
);

await check("the trackee cannot close a session to hide being watched", () =>
  assertFails(
    updateDoc(docRef(teenDb, "watchSessions", LINK_ID), { active: false }),
  ),
);

await check("a stranger cannot open a session on someone", () =>
  assertFails(
    setDoc(docRef(strangerDb, "watchSessions", `${STRANGER}__${TEEN}`), {
      trackerId: STRANGER,
      trackeeId: TEEN,
      trackerName: "Stranger",
      active: true,
      startedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
    }),
  ),
);

console.log("\nThe ceiling");

await check("startedAt cannot be slid forward on a live session", () =>
  assertFails(
    updateDoc(docRef(parentDb, "watchSessions", LINK_ID), {
      startedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
    }),
  ),
);

// Age the session past the ceiling without touching the rules, so what follows
// tests the ceiling rather than the write that would have created it.
await testEnv.withSecurityRulesDisabled(async (context) => {
  await setDoc(
    docRef(context.firestore(), "watchSessions", LINK_ID),
    { startedAt: Date.now() - 61000, lastHeartbeatAt: Date.now() - 61000 },
    { merge: true },
  );
});

await check("the position stops being served once the ceiling passes", () =>
  assertFails(getDoc(docRef(parentDb, "locations", TEEN))),
);

await check("an expired session cannot be kept alive by heartbeating", () =>
  assertFails(
    updateDoc(docRef(parentDb, "watchSessions", LINK_ID), {
      lastHeartbeatAt: Date.now(),
    }),
  ),
);

await check("closing an expired session is always allowed", () =>
  assertSucceeds(
    updateDoc(docRef(parentDb, "watchSessions", LINK_ID), {
      active: false,
      endedAt: Date.now(),
    }),
  ),
);

await check("...and looking again is immediate, but starts a new session", () =>
  assertSucceeds(
    updateDoc(docRef(parentDb, "watchSessions", LINK_ID), {
      active: true,
      startedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
    }),
  ),
);

console.log("\nPausing");

await check("the trackee may pause", () =>
  assertSucceeds(
    updateDoc(docRef(teenDb, "trackingLinks", LINK_ID), {
      pausedByTrackee: true,
    }),
  ),
);

await check("a paused trackee's watcher cannot heartbeat", () =>
  assertFails(
    updateDoc(docRef(parentDb, "watchSessions", LINK_ID), {
      lastHeartbeatAt: Date.now(),
    }),
  ),
);

await check("the tracker may still close the session they opened", () =>
  assertSucceeds(
    updateDoc(docRef(parentDb, "watchSessions", LINK_ID), {
      active: false,
      endedAt: Date.now(),
    }),
  ),
);

// The one that matters: pausing already emptied sharedWith, so a paused
// trackee's position was never readable. But until this rule existed a session
// could still be OPENED, which notified them that someone was checking on them
// while that someone saw nothing at all.
await check("a paused trackee cannot be watched at all", () =>
  assertFails(
    updateDoc(docRef(parentDb, "watchSessions", LINK_ID), {
      active: true,
      startedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
    }),
  ),
);

await check("unpausing lets the tracker look again", async () => {
  await assertSucceeds(
    updateDoc(docRef(teenDb, "trackingLinks", LINK_ID), {
      pausedByTrackee: false,
    }),
  );
  await assertSucceeds(
    updateDoc(docRef(parentDb, "watchSessions", LINK_ID), {
      active: true,
      startedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
    }),
  );
});

console.log("\nRevocation");

await check("the trackee may revoke", () =>
  assertSucceeds(
    updateDoc(docRef(teenDb, "trackingLinks", LINK_ID), { status: "revoked" }),
  ),
);

await testEnv.withSecurityRulesDisabled(async (context) => {
  await setDoc(
    docRef(context.firestore(), "locations", TEEN),
    { sharedWith: [] },
    { merge: true },
  );
});

await check("a revoked tracker loses access even mid-watch", () =>
  assertFails(getDoc(docRef(parentDb, "locations", TEEN))),
);

console.log("\nHistory");

await testEnv.withSecurityRulesDisabled(async (context) => {
  await setDoc(docRef(context.firestore(), "trackingEvents", "event-1"), {
    trackeeId: TEEN,
    trackerId: PARENT,
    trackerName: "Parent",
    startedAt: Date.now() - 60000,
    endedAt: Date.now(),
    durationMs: 60000,
  });
});

await check("the trackee can read their own history", () =>
  assertSucceeds(getDoc(docRef(teenDb, "trackingEvents", "event-1"))),
);

await check("a stranger cannot read someone's history", () =>
  assertFails(getDoc(docRef(strangerDb, "trackingEvents", "event-1"))),
);

await check("nobody can forge a history entry", () =>
  assertFails(
    setDoc(docRef(parentDb, "trackingEvents", "forged"), {
      trackeeId: TEEN,
      trackerId: PARENT,
      startedAt: 0,
      endedAt: 0,
      durationMs: 0,
    }),
  ),
);

await check("the trackee cannot rewrite their history", () =>
  assertFails(
    updateDoc(docRef(teenDb, "trackingEvents", "event-1"), { durationMs: 0 }),
  ),
);

await testEnv.cleanup();

const failed = results.filter((result) => !result.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed\n`,
);
process.exit(failed.length === 0 ? 0 : 1);
