// Shared formatting for tracking UI. Freshness is shown everywhere a position
// is, because a pin with no age reads as "here now" even when it is an hour old.

import type { LocationDoc } from "../app/types/tracking";
import { LOCATION_STALE_MS } from "./constants";

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
