// One subscription to the tracking graph, plus ownership of the current watch
// sessions, shared by everything that needs them: the Track tab, the map, the
// chat mini map, the tab badge, and the "someone is watching you" banner.
//
// Watch sessions live here rather than in a screen because they deliberately
// span screens. Tapping a pin on the map to open that person's chat is a
// continuation of one act of looking, not a new one, so the session — and the
// single notification it caused — carries across the navigation.
//
// The set of watched people only ever grows by an explicit tap (Track on the
// trackees list, or a name from Other Trackees on the map), and every addition
// notifies that person. Nothing is ever added implicitly.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import type { TrackingLinkDoc, WatchSessionDoc } from "../app/types/tracking";
import {
  endWatchSession,
  heartbeatWatchSession,
  listenForTrackingLinks,
  listenForWatchersOfMe,
  startWatchSession,
} from "../tracking-api";
import { WATCH_HEARTBEAT_MS } from "./constants";

export type WatchTarget = {
  trackeeId: string;
  trackeeName: string;
};

export type ActiveWatch = WatchTarget & {
  startedAt: number;
};

type TrackingContextValue = {
  userId: string | null;
  myName: string;
  /** Active links where I am the tracker — the people I may look at. */
  trackees: TrackingLinkDoc[];
  /** Active links where I am the trackee — the people who may look at me. */
  trackers: TrackingLinkDoc[];
  incomingRequests: TrackingLinkDoc[];
  outgoingRequests: TrackingLinkDoc[];
  /** Who is looking at my location right now. */
  watchers: WatchSessionDoc[];
  /** Who I am looking at right now. Empty unless I deliberately opened a view. */
  activeWatches: ActiveWatch[];
  /** Replaces the watched set. Declared by the focused screen — see useWatchScope. */
  setWatchTargets: (targets: WatchTarget[]) => void;
  /** Adds one person to the map. Notifies them. */
  addWatchTarget: (target: WatchTarget) => void;
  /** Removes one person from the map, ending their session. */
  removeWatchTarget: (trackeeId: string) => void;
  isLoading: boolean;
};

const EMPTY: TrackingContextValue = {
  userId: null,
  myName: "",
  trackees: [],
  trackers: [],
  incomingRequests: [],
  outgoingRequests: [],
  watchers: [],
  activeWatches: [],
  setWatchTargets: () => {},
  addWatchTarget: () => {},
  removeWatchTarget: () => {},
  isLoading: true,
};

const TrackingContext = createContext<TrackingContextValue>(EMPTY);

export const useTracking = () => useContext(TrackingContext);

const sameTargets = (a: WatchTarget[], b: WatchTarget[]) => {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((target) => target.trackeeId));
  return b.every((target) => ids.has(target.trackeeId));
};

export const TrackingProvider = ({
  userId,
  myName,
  children,
}: {
  userId: string | null;
  myName: string;
  children: ReactNode;
}) => {
  const [links, setLinks] = useState<TrackingLinkDoc[]>([]);
  const [watchers, setWatchers] = useState<WatchSessionDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targets, setTargets] = useState<WatchTarget[]>([]);
  const [activeWatches, setActiveWatches] = useState<ActiveWatch[]>([]);
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active",
  );

  useEffect(() => {
    if (!userId) {
      setLinks([]);
      setWatchers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubLinks = listenForTrackingLinks(userId, (nextLinks) => {
      setLinks(nextLinks);
      setIsLoading(false);
    });
    const unsubWatchers = listenForWatchersOfMe(userId, setWatchers);

    return () => {
      unsubLinks();
      unsubWatchers();
    };
  }, [userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => setIsAppActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);

  // Reconcile open sessions with what the focused screen wants. Backgrounding
  // counts as not looking, so the trackee's banner clears rather than implying
  // they are still being watched from inside a pocket.
  const openIdsRef = useRef<string[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const wanted = isAppActive ? targets : [];
    const wantedIds = wanted.map((target) => target.trackeeId);
    const toClose = openIdsRef.current.filter(
      (openId) => !wantedIds.includes(openId),
    );
    const toOpen = wanted.filter(
      (target) => !openIdsRef.current.includes(target.trackeeId),
    );

    if (toClose.length === 0 && toOpen.length === 0) return;

    openIdsRef.current = wantedIds;
    const openedAt = Date.now();
    setActiveWatches((current) =>
      wanted.map(
        (target) =>
          current.find((watch) => watch.trackeeId === target.trackeeId) ?? {
            ...target,
            startedAt: openedAt,
          },
      ),
    );

    toClose.forEach((trackeeId) => {
      endWatchSession({ trackerId: userId, trackeeId }).catch(() => {});
    });
    toOpen.forEach((target) => {
      startWatchSession({
        trackerId: userId,
        trackerName: myName,
        trackeeId: target.trackeeId,
      }).catch(() => {});
    });

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (wantedIds.length > 0) {
      heartbeatRef.current = setInterval(() => {
        openIdsRef.current.forEach((trackeeId) => {
          heartbeatWatchSession({ trackerId: userId, trackeeId }).catch(
            () => {},
          );
        });
      }, WATCH_HEARTBEAT_MS);
    }
  }, [isAppActive, myName, targets, userId]);

  // Unmounting the provider (sign-out, app teardown) must not leave sessions
  // open, or the trackee keeps seeing a banner for a tracker who has gone.
  useEffect(
    () => () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (!userId) return;
      openIdsRef.current.forEach((trackeeId) => {
        endWatchSession({ trackerId: userId, trackeeId }).catch(() => {});
      });
      openIdsRef.current = [];
    },
    [userId],
  );

  useEffect(() => {
    if (userId) return;
    setTargets([]);
  }, [userId]);

  const setWatchTargets = useCallback((next: WatchTarget[]) => {
    setTargets((current) => (sameTargets(current, next) ? current : next));
  }, []);

  const addWatchTarget = useCallback((target: WatchTarget) => {
    setTargets((current) =>
      current.some((existing) => existing.trackeeId === target.trackeeId)
        ? current
        : [...current, target],
    );
  }, []);

  const removeWatchTarget = useCallback((trackeeId: string) => {
    setTargets((current) =>
      current.filter((target) => target.trackeeId !== trackeeId),
    );
  }, []);

  const value = useMemo<TrackingContextValue>(() => {
    const isTracker = (link: TrackingLinkDoc) => link.trackerId === userId;
    const isTrackee = (link: TrackingLinkDoc) => link.trackeeId === userId;

    return {
      userId,
      myName,
      trackees: links.filter(
        (link) => isTracker(link) && link.status === "active",
      ),
      trackers: links.filter(
        (link) => isTrackee(link) && link.status === "active",
      ),
      incomingRequests: links.filter(
        (link) => isTrackee(link) && link.status === "pending",
      ),
      outgoingRequests: links.filter(
        (link) => isTracker(link) && link.status === "pending",
      ),
      watchers,
      activeWatches,
      setWatchTargets,
      addWatchTarget,
      removeWatchTarget,
      isLoading,
    };
  }, [
    activeWatches,
    addWatchTarget,
    isLoading,
    links,
    myName,
    removeWatchTarget,
    setWatchTargets,
    userId,
    watchers,
  ]);

  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  );
};
