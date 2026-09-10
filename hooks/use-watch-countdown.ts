// How long the current look has left. Runs only while the map is mounted, and
// only reports the soonest expiry — several people watched at once all end on
// their own clocks, but the one about to end is the one worth a countdown.

import { useEffect, useState } from "react";

import { WATCH_EXPIRY_WARNING_MS } from "../tracking/constants";
import type { ActiveWatch } from "../tracking/tracking-provider";

export const useWatchCountdown = (activeWatches: ActiveWatch[]) => {
  const soonest =
    activeWatches.length > 0 ?
      Math.min(...activeWatches.map((watch) => watch.expiresAt)) :
      0;

  const [msRemaining, setMsRemaining] = useState(() =>
    soonest > 0 ? soonest - Date.now() : 0,
  );

  useEffect(() => {
    if (soonest === 0) {
      setMsRemaining(0);
      return;
    }
    setMsRemaining(soonest - Date.now());
    // Twice a second, so the number never appears to skip or stall on a
    // boundary. Cheap: this only runs while someone is actually being watched.
    const timer = setInterval(() => {
      setMsRemaining(soonest - Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, [soonest]);

  return {
    secondsRemaining: Math.max(0, Math.ceil(msRemaining / 1000)),
    isEnding: soonest > 0 && msRemaining <= WATCH_EXPIRY_WARNING_MS,
  };
};
