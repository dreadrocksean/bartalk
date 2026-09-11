// Shared formatting for tracking UI. Freshness is shown everywhere a position
// is, because a pin with no age reads as "here now" even when it is an hour old.

import type { LocationDoc } from "../app/types/tracking";
import { LOCATION_STALE_MS, SHARING_STALE_MS } from "./constants";

export const formatAge = (timestamp: number | null | undefined): string => {
  if (!timestamp) return "no location yet";

  const elapsed = Date.now() - timestamp;
  if (elapsed < 45_000) return "just now";

  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
};

export const isLocationStale = (location: LocationDoc | null | undefined) =>
  !location || Date.now() - location.capturedAt > LOCATION_STALE_MS;

/** Reads a watch duration as a clock, for the banner the trackee sees. */
export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const initialsOf = (name: string): string =>
  name
    .split(" ")
    .map((part) => part?.[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

/**
 * What a link can honestly say about whether the other person is still sharing.
 *
 * The tracker cannot see their position from a list — the rules keep that
 * behind an open watch session, which is the whole point — so this reports only
 * whether the mechanism is working, never where anyone is. It is the difference
 * between "they have stopped sharing" and "they are at this address", and only
 * the first is anyone's business from a row in a list.
 *
 * The silence cases are worded as observations rather than accusations. A phone
 * in a pocket with no signal looks identical to someone avoiding you, and the
 * app is not in a position to tell the reader which one it is looking at.
 */
export const describeSharing = (link: {
  pausedByTrackee?: boolean;
  kind?: string;
  trackeeLastPublishedAt?: number;
  trackeePermissionState?: string;
}): { text: string; isWarning: boolean } => {
  const isDependant = link.kind === "dependant";

  if (link.pausedByTrackee) {
    return { text: "Paused sharing", isWarning: true };
  }

  if (link.trackeePermissionState === "denied") {
    return {
      text: "Location is off on their phone",
      isWarning: true,
    };
  }

  const publishedAt = link.trackeeLastPublishedAt;
  if (typeof publishedAt !== "number" || publishedAt === 0) {
    return {
      text: isDependant ? "No position yet" : "Nothing shared yet",
      isWarning: true,
    };
  }

  const age = Date.now() - publishedAt;
  if (age > SHARING_STALE_MS) {
    return { text: `No position for ${formatAge(publishedAt)}`, isWarning: true };
  }

  return {
    text: isDependant ? "Your dependant — can't pause or stop" : "Sharing with you",
    isWarning: false,
  };
};
