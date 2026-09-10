// The trackee's own record of who checked on them. Written only by the server,
// so it cannot be forged by a tracker or quietly erased from a device.

import { useEffect, useState } from "react";

import type { TrackingEventDoc } from "../app/types/tracking";
import { listenForTrackingEvents } from "../tracking-api";

export const useTrackingEvents = (userId: string | null) => {
  const [events, setEvents] = useState<TrackingEventDoc[]>([]);

  useEffect(() => {
    if (!userId) {
      setEvents([]);
      return;
    }
    return listenForTrackingEvents(userId, setEvents);
  }, [userId]);

  return events;
};
