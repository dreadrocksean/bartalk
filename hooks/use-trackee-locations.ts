// Live positions for a set of people. One document listener each, which suits
// family-sized groups and avoids the 30-id ceiling on "in" queries.
//
// Only ever called with people whose sessions are already open, so subscribing
// here can never be a way to see a position without the notification.

import { useEffect, useState } from "react";

import type { LocationDoc } from "../app/types/tracking";
import { listenForLocation } from "../tracking-api";

export const useTrackeeLocations = (trackeeIds: string[]) => {
  const [locations, setLocations] = useState<Record<string, LocationDoc>>({});
  const key = [...trackeeIds].sort().join(",");

  useEffect(() => {
    const ids = key.length > 0 ? key.split(",") : [];
    if (ids.length === 0) {
      setLocations({});
      return;
    }

    // Drop anyone we're no longer watching, so a stale pin can't linger.
    setLocations((current) => {
      const next: Record<string, LocationDoc> = {};
      ids.forEach((trackeeId) => {
        if (current[trackeeId]) next[trackeeId] = current[trackeeId];
      });
      return next;
    });

    const unsubscribers = ids.map((trackeeId) =>
      listenForLocation(trackeeId, (location) => {
        setLocations((current) => {
          if (!location) {
            if (!(trackeeId in current)) return current;
            const { [trackeeId]: _removed, ...rest } = current;
            return rest;
          }
          return { ...current, [trackeeId]: location };
        });
      }),
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [key]);

  return locations;
};
