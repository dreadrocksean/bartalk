// Shared tuning for device tracking. Kept in one place because these values are
// the difference between a useful map and a flat battery, and because shipping a
// change to them over the air should not mean hunting through screens.

/** How often the tracker's device says "I am still looking". */
export const WATCH_HEARTBEAT_MS = 20_000;

/**
 * A session whose heartbeat is older than this is considered dead and gets
 * closed server-side, so a force-quit can't leave the trackee's banner stuck on.
 */
export const WATCH_SESSION_STALE_MS = 90_000;

/** Re-opening the map within this window does not re-notify the trackee. */
export const WATCH_NOTIFY_COOLDOWN_MS = 120_000;

/** Background publishing while at least one link is active but nobody watches. */
export const IDLE_LOCATION_INTERVAL_MS = 60_000;
export const IDLE_LOCATION_DISTANCE_M = 100;

/** Foreground publishing while someone is actively watching. */
export const LIVE_LOCATION_INTERVAL_MS = 5_000;
export const LIVE_LOCATION_DISTANCE_M = 10;

/** Don't write the same position to Firestore more often than this. */
export const LOCATION_WRITE_THROTTLE_MS = 4_000;

/** Past this age a pin is drawn as stale rather than pretending to be current. */
export const LOCATION_STALE_MS = 180_000;

/** Task name registered with expo-task-manager. Must be stable across releases. */
export const BACKGROUND_LOCATION_TASK = "bartalk-background-location";

/** Separates the two uids in trackingLinks / watchSessions document ids. */
export const TRACKING_ID_SEPARATOR = "__";

export const buildTrackingLinkId = (trackerId: string, trackeeId: string) =>
  `${trackerId}${TRACKING_ID_SEPARATOR}${trackeeId}`;

export const buildWatchSessionId = (trackerId: string, trackeeId: string) =>
  `${trackerId}${TRACKING_ID_SEPARATOR}${trackeeId}`;

// -------- Map framing --------

/**
 * How long after the last manual gesture before the camera reclaims the frame.
 * The single number the whole auto-fit behaviour turns on.
 */
export const AUTO_FIT_RESUME_DELAY_MS = 8_000;

/**
 * Room left around the two pins. Bottom is heavier because the trackee panel
 * sits there and a pin hidden behind it may as well not be on the map.
 */
export const AUTO_FIT_EDGE_PADDING = {
  top: 140,
  right: 72,
  bottom: 260,
  left: 72,
} as const;

/**
 * Android reports region changes several times during one animation, so
 * movement within this window of a programmatic fit is not treated as the user
 * taking over.
 */
export const AUTO_FIT_ANIMATION_GUARD_MS = 1_200;

/** Floor on the fitted span, so two people in one room don't max out the zoom. */
export const MIN_FIT_SPAN_DELTA = 0.004;
