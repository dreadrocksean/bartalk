// Firestore data layer for device tracking. Kept beside api.ts, which serves the
// messaging half of the app, and follows the same modular-SDK conventions.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";

import { getApp } from "@react-native-firebase/app";
import {
  getFunctions,
  httpsCallable,
} from "@react-native-firebase/functions";

import {
  DEPENDANT_RELEASE_DELAY_MS,
  type LocationDoc,
  type LocationPermissionState,
  type LocationPublishMode,
  type TrackingEventDoc,
  type TrackingLinkDoc,
  type WatchSessionDoc,
} from "./app/types/tracking";
import { getFirebaseDb } from "./firebase";
import { buildTrackingLinkId, buildWatchSessionId } from "./tracking/constants";

const TRACKING_LINKS = "trackingLinks";
const LOCATIONS = "locations";
const WATCH_SESSIONS = "watchSessions";
const TRACKING_EVENTS = "trackingEvents";

const getDb = () => getFirebaseDb();

const withId = <T>(snapshot: FirebaseFirestoreTypes.DocumentSnapshot): T =>
  ({ id: snapshot.id, ...snapshot.data() }) as T;

/**
 * Listener failures surface as an empty list so the UI degrades instead of
 * crashing — but an empty list looks identical to "no data", which hides the
 * two causes that actually happen: a missing composite index, and rules that
 * haven't been deployed. Say so in development rather than failing silently.
 */
const reportListenerError = (source: string) => (error: unknown) => {
  if (__DEV__) {
    console.warn(
      `[tracking] ${source} listener failed — check that firestore.rules and ` +
        "firestore.indexes.json are deployed.",
      error,
    );
  }
};

// ***************************//
// ------Tracking links-------//
// ***************************//

/**
 * A tracker asks to follow a trackee. Nothing is shared until the trackee
 * accepts. Re-asking someone who already accepted is a no-op rather than a
 * silent downgrade of a live link back to "pending".
 */
export const requestTrackingLink = async ({
  trackerId,
  trackerName,
  trackeeId,
  trackeeName,
}: {
  trackerId: string;
  trackerName: string;
  trackeeId: string;
  trackeeName: string;
}): Promise<{ linkId: string; alreadyActive: boolean }> => {
  const linkId = buildTrackingLinkId(trackerId, trackeeId);
  const linkDoc = doc(getDb(), TRACKING_LINKS, linkId);
  const existing = await getDoc(linkDoc);

  if (existing.exists() && existing.data()?.status === "active") {
    return { linkId, alreadyActive: true };
  }

  await setDoc(
    linkDoc,
    {
      trackerId,
      trackeeId,
      members: [trackerId, trackeeId],
      trackerName,
      trackeeName,
      status: "pending",
      pausedByTrackee: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return { linkId, alreadyActive: false };
};

/** Only the trackee may call this — enforced in firestore.rules. */
export const respondToTrackingLink = ({
  linkId,
  accept,
}: {
  linkId: string;
  accept: boolean;
}) =>
  updateDoc(doc(getDb(), TRACKING_LINKS, linkId), {
    status: accept ? "active" : "declined",
    pausedByTrackee: false,
    respondedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

/** Temporarily stop sharing without tearing the link down. */
export const setTrackingLinkPaused = ({
  linkId,
  paused,
}: {
  linkId: string;
  paused: boolean;
}) =>
  updateDoc(doc(getDb(), TRACKING_LINKS, linkId), {
    pausedByTrackee: paused,
    updatedAt: serverTimestamp(),
  });

/** Either party can end a link for good. */
export const revokeTrackingLink = (linkId: string) =>
  updateDoc(doc(getDb(), TRACKING_LINKS, linkId), {
    status: "revoked",
    updatedAt: serverTimestamp(),
  });

/** Every link this user is part of, in either role. */
export const listenForTrackingLinks = (
  userId: string,
  callback: (links: TrackingLinkDoc[]) => void,
) => {
  const q = query(
    collection(getDb(), TRACKING_LINKS),
    where("members", "array-contains", userId),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot) {
        callback([]);
        return;
      }
      callback(
        snapshot.docs.map(
          (linkDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
            withId<TrackingLinkDoc>(linkDoc),
        ),
      );
    },
    (error: unknown) => {
      reportListenerError("trackingLinks")(error);
      callback([]);
    },
  );
};

// ***************************//
// ---------Locations---------//
// ***************************//

export type PublishLocationInput = {
  userId: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  batteryLevel?: number | null;
  capturedAt: number;
  mode: LocationPublishMode;
  sharedWith: string[];
  permissionState: LocationPermissionState;
};

/**
 * The trackee's own device is the only writer of its position, and it writes
 * `sharedWith` itself from its active links — that array is what firestore.rules
 * reads to decide who may see the document.
 */
export const publishLocation = ({
  userId,
  lat,
  lng,
  accuracy = null,
  heading = null,
  speed = null,
  batteryLevel = null,
  capturedAt,
  mode,
  sharedWith,
  permissionState,
}: PublishLocationInput) =>
  setDoc(
    doc(getDb(), LOCATIONS, userId),
    {
      lat,
      lng,
      accuracy,
      heading,
      speed,
      batteryLevel,
      capturedAt,
      mode,
      sharedWith,
      permissionState,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

/**
 * Applied the moment a link is paused or revoked, so access ends immediately
 * rather than at the next position write.
 */
export const setLocationAudience = ({
  userId,
  sharedWith,
  permissionState,
}: {
  userId: string;
  sharedWith: string[];
  permissionState?: LocationPermissionState;
}) =>
  setDoc(
    doc(getDb(), LOCATIONS, userId),
    permissionState
      ? { sharedWith, permissionState, updatedAt: serverTimestamp() }
      : { sharedWith, updatedAt: serverTimestamp() },
    { merge: true },
  );

/**
 * Security rules only expose a position while a watch session is open, and the
 * session write and this subscription are in flight at the same moment — so a
 * first attempt can lose the race and be denied. Retrying briefly is the
 * difference between "they were told and you see them" and a blank map.
 *
 * Once the retries are exhausted the denial is real: the link was revoked, or
 * paused, while we were looking.
 */
const LOCATION_RETRY_DELAYS_MS = [400, 900, 1800, 3000];

/**
 * A position document can exist with no position in it.
 *
 * setLocationAudience creates or merges the document the moment a link is
 * accepted, writing only who may read it — so between accepting and the first
 * fix there is a document with no lat or lng at all, and if the trackee's
 * location is switched off there never will be. Callers reasonably test
 * `if (location)`, which is true for that shell, and then read coordinates that
 * are undefined. Treating it as no location at all is the only answer that is
 * true everywhere: there is genuinely nowhere to draw.
 */
const hasCoordinates = (location: LocationDoc | null): boolean =>
  !!location &&
  typeof location.lat === "number" &&
  Number.isFinite(location.lat) &&
  typeof location.lng === "number" &&
  Number.isFinite(location.lng);

export const listenForLocation = (
  trackeeId: string,
  callback: (location: LocationDoc | null) => void,
) => {
  let isCancelled = false;
  let unsubscribe: (() => void) | null = null;
  let attempt = 0;

  const subscribe = () => {
    if (isCancelled) return;
    unsubscribe = onSnapshot(
      doc(getDb(), LOCATIONS, trackeeId),
      (snapshot) => {
        attempt = 0;
        const location = snapshot?.exists() ?
          withId<LocationDoc>(snapshot) :
          null;
        callback(hasCoordinates(location) ? location : null);
      },
      () => {
        unsubscribe?.();
        unsubscribe = null;
        if (isCancelled) return;

        if (attempt < LOCATION_RETRY_DELAYS_MS.length) {
          const delay = LOCATION_RETRY_DELAYS_MS[attempt];
          attempt += 1;
          setTimeout(subscribe, delay);
          return;
        }
        callback(null);
      },
    );
  };

  subscribe();

  return () => {
    isCancelled = true;
    unsubscribe?.();
  };
};

// ***************************//
// ------Watch sessions-------//
// ***************************//

/**
 * Opening a live view of someone. This write is what triggers the notification
 * to the trackee, so it must happen before any position is shown — never after,
 * and never conditionally.
 */
export const startWatchSession = async ({
  trackerId,
  trackerName,
  trackeeId,
}: {
  trackerId: string;
  trackerName: string;
  trackeeId: string;
}) => {
  const open = () => {
    const now = Date.now();
    return setDoc(
      doc(getDb(), WATCH_SESSIONS, buildWatchSessionId(trackerId, trackeeId)),
      {
        trackerId,
        trackeeId,
        trackerName,
        active: true,
        startedAt: now,
        lastHeartbeatAt: now,
        endedAt: null,
      },
      { merge: true },
    );
  };

  try {
    await open();
  } catch {
    // The rules refuse a fresh start time on a session that is still marked
    // active, because reopening has to cross inactive -> active — that edge is
    // what notifies the trackee, and letting a start time slide forward would
    // be a way to keep watching in silence.
    //
    // So a session orphaned by a crash blocks the next one. Close it first:
    // that writes the audit entry the crash never wrote and tells the trackee
    // the old look ended, and only then does the new look begin, announcing
    // itself the way every look does.
    await endWatchSession({ trackerId, trackeeId });
    await open();
  }
};

export const heartbeatWatchSession = ({
  trackerId,
  trackeeId,
}: {
  trackerId: string;
  trackeeId: string;
}) =>
  updateDoc(
    doc(getDb(), WATCH_SESSIONS, buildWatchSessionId(trackerId, trackeeId)),
    { lastHeartbeatAt: Date.now() },
  );

export const endWatchSession = ({
  trackerId,
  trackeeId,
}: {
  trackerId: string;
  trackeeId: string;
}) =>
  updateDoc(
    doc(getDb(), WATCH_SESSIONS, buildWatchSessionId(trackerId, trackeeId)),
    { active: false, endedAt: Date.now() },
  );

/** Who is looking at me right now. Drives the banner the trackee sees. */
export const listenForWatchersOfMe = (
  trackeeId: string,
  callback: (sessions: WatchSessionDoc[]) => void,
) => {
  const q = query(
    collection(getDb(), WATCH_SESSIONS),
    where("trackeeId", "==", trackeeId),
    where("active", "==", true),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot) {
        callback([]);
        return;
      }
      callback(
        snapshot.docs.map(
          (sessionDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
            withId<WatchSessionDoc>(sessionDoc),
        ),
      );
    },
    (error: unknown) => {
      reportListenerError("watchSessions")(error);
      callback([]);
    },
  );
};

// ***************************//
// ------Tracking events------//
// ***************************//

/** The trackee's history of who checked on them. Written only by the server. */
export const listenForTrackingEvents = (
  trackeeId: string,
  callback: (events: TrackingEventDoc[]) => void,
  pageSize = 50,
) => {
  const q = query(
    collection(getDb(), TRACKING_EVENTS),
    where("trackeeId", "==", trackeeId),
    orderBy("startedAt", "desc"),
    limit(pageSize),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot) {
        callback([]);
        return;
      }
      callback(
        snapshot.docs.map(
          (eventDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
            withId<TrackingEventDoc>(eventDoc),
        ),
      );
    },
    (error: unknown) => {
      reportListenerError("trackingEvents")(error);
      callback([]);
    },
  );
};

// ***************************//
// -----------Users-----------//
// ***************************//

export type TrackingContact = {
  id: string;
  name: string;
};

/** Contacts available to ask to follow: every other user in the directory. */
export const fetchTrackingContacts = async (
  currentUserId: string,
): Promise<TrackingContact[]> => {
  const snapshot = await getDocs(collection(getDb(), "Users"));
  return snapshot.docs
    .filter(
      (userDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
        userDoc.id !== currentUserId,
    )
    .map((userDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const data = userDoc.data() ?? {};
      const name = `${data.fname ?? ""} ${data.lname ?? ""}`.trim();
      return { id: userDoc.id, name: name.length > 0 ? name : "Unknown" };
    })
    .sort((a: TrackingContact, b: TrackingContact) =>
      a.name.localeCompare(b.name),
    );
};

// ***************************//
// ------Guardianship---------//
// ***************************//

/**
 * Guardianship is created server-side and nowhere else, so these two calls are
 * the whole client surface for establishing it. A tracker cannot write a
 * dependant link directly — firestore.rules lets a client create friendships
 * only — which is what stops anyone declaring another person their dependant.
 */
const callFunction = async <T>(
  name: string,
  payload: Record<string, unknown> = {},
): Promise<T> => {
  const callable = httpsCallable<Record<string, unknown>, T>(
    getFunctions(getApp()),
    name,
  );
  const result = await callable(payload);
  return result.data;
};

/**
 * Step one, on the guardian's own device. The code is carried to the
 * dependant's phone and typed there — possession is the proof of authority,
 * which is the same thing Family Sharing and Family Link settle on.
 */
export const createPairingCode = () =>
  callFunction<{ code: string; expiresAt: number }>("createPairingCode");

/**
 * Step two, on the dependant's device, signed in as the dependant. Their auth
 * on this call is the evidence the phone was actually handed over — it cannot
 * be produced remotely, which is what stops anyone declaring a stranger their
 * dependant.
 */
export const redeemPairingCode = (code: string) =>
  callFunction<{ linkId: string; guardianName: string }>("redeemPairingCode", {
    code,
  });

/**
 * A dependant asking to be let go.
 *
 * This always works. Guardianship a person cannot leave is the shape this
 * feature takes when it is turned against someone, so the exit is not the
 * guardian's to grant — it is only theirs to notice, and to talk about, in the
 * time the delay buys. The effective time is pinned here and checked again in
 * firestore.rules: asking to leave and leaving must not be the same act.
 */
export const requestRelease = (linkId: string) => {
  const requestedAt = Date.now();
  return updateDoc(doc(getDb(), TRACKING_LINKS, linkId), {
    releaseRequestedAt: requestedAt,
    releaseEffectiveAt: requestedAt + DEPENDANT_RELEASE_DELAY_MS,
    updatedAt: serverTimestamp(),
  });
};

/** Everyone who may see this user without being able to be switched off. */
export const guardiansOf = (links: TrackingLinkDoc[], userId: string) =>
  links.filter(
    (link) =>
      link.trackeeId === userId &&
      link.kind === "dependant" &&
      link.status === "active",
  );
