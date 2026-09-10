// Firestore document types for BarTalk device tracking.

import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

/**
 * A tracker (parent) asks to follow a trackee (child). Nothing is shared until
 * the trackee moves the link to "active", and the trackee can pause or revoke it
 * at any time.
 */
export type TrackingLinkStatus = "pending" | "active" | "declined" | "revoked";

export type TrackingLinkDoc = {
  id: string;
  trackerId: string;
  trackeeId: string;
  /** Both ids, so each side can query their links with array-contains. */
  members: string[];
  trackerName: string;
  trackeeName: string;
  status: TrackingLinkStatus;
  pausedByTrackee: boolean;
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
