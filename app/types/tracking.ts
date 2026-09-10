// Firestore document types for BarTalk device tracking.

import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

/**
 * A tracker (parent) asks to follow a trackee (child). Nothing is shared until
 * the trackee moves the link to "active", and the trackee can pause or revoke it
 * at any time.
 */
export type TrackingLinkStatus = "pending" | "active" | "declined" | "revoked";

/**
 * What kind of relationship a link describes, and therefore who controls it.
 *
 * A friend decides everything about being seen: they accept, they pause, they
 * revoke. A dependant does not — a child cannot switch off their parent.
 *
 * This lives on the link and not on the user because "dependant" is not a fact
 * about a person, it is a fact about one relationship. The same teenager is
 * supervised by a parent and an equal to their friends, and may be a tracker of
 * a younger sibling; a role stamped on their user document would make a claim
 * that is only true inside one edge of the graph.
 *
 * Crucially, a client may only ever create a "friend" link — see
 * firestore.rules. Guardianship is created by a Cloud Function after a pairing
 * code is redeemed on the dependant's own device, because a tracker who could
 * declare someone a dependant could strip that person's controls at will.
 */
export type TrackingLinkKind = "friend" | "dependant";

/**
 * How long after a dependant asks to be released it happens on its own.
 *
 * A dependant who cannot leave at all is how this feature gets turned against
 * someone: "dependant" is exactly the label a controlling partner reaches for,
 * and guardian-only removal hands them the lock. So the exit always works, and
 * it always tells the guardian — a parent re-establishes the link in seconds,
 * while someone who needs out gets out.
 *
 * The delay is a genuine trade-off, not a solved problem. Shorter, and a child
 * goes dark before a parent can respond. Longer, and someone in a bad situation
 * waits while the person controlling them knows they asked to leave.
 *
 * A day covers what the parent case actually needs — notice it, and have the
 * conversation, including one overnight. Past that the containment value
 * flattens, because a dependant who truly wants out can delete the app or
 * revoke location permission in Settings and always could. What protects the
 * guardian here is being told immediately, not the length of the wait.
 */
export const DEPENDANT_RELEASE_DELAY_MS = 86_400_000; // 24 hours

export type TrackingLinkDoc = {
  id: string;
  trackerId: string;
  trackeeId: string;
  /** Both ids, so each side can query their links with array-contains. */
  members: string[];
  trackerName: string;
  trackeeName: string;
  status: TrackingLinkStatus;
  /** Absent on links created before guardianship existed; treat as "friend". */
  kind?: TrackingLinkKind;
  pausedByTrackee: boolean;
  /** Dependant links only: when the dependant asked to be let go. */
  releaseRequestedAt?: number;
  /** Dependant links only: when that request completes on its own. */
  releaseEffectiveAt?: number;
  establishedAt?: FirebaseFirestoreTypes.Timestamp;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
  respondedAt?: FirebaseFirestoreTypes.Timestamp;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
};

/** How much location the trackee's device is currently able to publish. */
export type LocationPermissionState = "always" | "whenInUse" | "denied";

/** Idle = coarse background updates. Live = someone is watching right now. */
export type LocationPublishMode = "idle" | "live";

export type LocationDoc = {
  id: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  batteryLevel?: number | null;
  /** Device clock, ms. When the fix was taken. */
  capturedAt: number;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
  mode: LocationPublishMode;
  /**
   * Tracker ids allowed to read this document. Written by the trackee's own
   * device from its active, unpaused links, and enforced in firestore.rules.
   */
  sharedWith: string[];
  permissionState: LocationPermissionState;
};

/**
 * One document per (tracker, trackee) pair, written only by the tracker while
 * they have the map open. This is what tells the trackee they are being looked
 * at, so the trackee is deliberately given no way to delete or suppress it.
 */
export type WatchSessionDoc = {
  id: string;
  trackerId: string;
  trackeeId: string;
  trackerName: string;
  active: boolean;
  startedAt: number;
  lastHeartbeatAt: number;
  endedAt?: number | null;
  /** Set by the Cloud Function after it pushes, to enforce the notify cooldown. */
  notifiedAt?: number | null;
};

/** Append-only audit log of completed watches. Written only by the server. */
export type TrackingEventDoc = {
  id: string;
  trackeeId: string;
  trackerId: string;
  trackerName: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
};

/** A trackee as rendered on the tracker's map and panel. */
export type TrackeeView = {
  linkId: string;
  trackeeId: string;
  name: string;
  paused: boolean;
  location: LocationDoc | null;
};

export type LatLng = {
  latitude: number;
  longitude: number;
};
