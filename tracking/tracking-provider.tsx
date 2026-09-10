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
//
// Every look also ends. WATCH_SESSION_MAX_MS after it opens, the session is
// closed here and the person drops off the map — and firestore.rules stops
// serving their position at the same moment, so this is the app keeping in step
// with the database rather than the app being trusted to stop. Looking again is
// allowed immediately, but it takes a deliberate tap and it notifies again:
// what is bounded is the length of a look, not how often someone may look.

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
import { WATCH_HEARTBEAT_MS, WATCH_SESSION_MAX_MS } from "./constants";

export type WatchTarget = {
  trackeeId: string;
  trackeeName: string;
};

export type ActiveWatch = WatchTarget & {
  startedAt: number;
  /** When the ceiling closes this session, with or without the tracker. */
  expiresAt: number;
};

/** A look that reached the ceiling. Kept so the map can say so. */
export type ExpiredWatch = WatchTarget & {
  endedAt: number;
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
  /** Looks that hit the ceiling and are waiting on a decision to resume. */
  expiredWatches: ExpiredWatch[];
  /** Replaces the watched set. Declared by the focused screen — see useWatchScope. */
  setWatchTargets: (targets: WatchTarget[]) => void;
  /** Adds one person to the map. Notifies them. */
  addWatchTarget: (target: WatchTarget) => void;
  /** Removes one person from the map, ending their session. */
  removeWatchTarget: (trackeeId: string) => void;
  /** Starts a fresh look at someone whose last one expired. Notifies them. */
  resumeWatch: (target: WatchTarget) => void;
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
  expiredWatches: [],
  setWatchTargets: () => {},
  addWatchTarget: () => {},
  removeWatchTarget: () => {},
  resumeWatch: () => {},
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
  const [expiredWatches, setExpiredWatches] = useState<ExpiredWatch[]>([]);
  // Only a real trip to the background counts as not looking. "inactive" is
  // the app switcher, Control Centre, an incoming call, a permission alert —
  // the tracker is still on the map behind all of those, and treating each one
  // as the end of a look would close and reopen the session, notifying the
  // trackee twice for something they did not do.
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState !== "background",
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
      (state: AppStateStatus) => setIsAppActive(state !== "background"),
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
      wanted.map((target) => {
        const existing = current.find(
          (watch) => watch.trackeeId === target.trackeeId,
        );
        if (existing) return existing;
        return {
          ...target,
          startedAt: openedAt,
          expiresAt: openedAt + WATCH_SESSION_MAX_MS,
        };
      }),
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

  // The ceiling. One timer, armed for whichever session expires first, rather
  // than a clock ticking every second in a provider the whole tree consumes.
  useEffect(() => {
    if (activeWatches.length === 0) return;

    const soonest = Math.min(
      ...activeWatches.map((watch) => watch.expiresAt),
    );
    const timer = setTimeout(
      () => {
        const now = Date.now();
        const due = activeWatches.filter((watch) => watch.expiresAt <= now);
        if (due.length === 0) return;

        setExpiredWatches((current) => [
          ...current.filter(
            (watch) =>
              !due.some((expired) => expired.trackeeId === watch.trackeeId),
          ),
          ...due.map((watch) => ({
            trackeeId: watch.trackeeId,
            trackeeName: watch.trackeeName,
            endedAt: now,
          })),
        ]);
        // Dropping the target is what closes the session, which is what writes
        // the audit entry and tells the trackee the look is over.
        setTargets((current) =>
          current.filter(
            (target) =>
              !due.some((expired) => expired.trackeeId === target.trackeeId),
          ),
        );
      },
      Math.max(0, soonest - Date.now()),
    );

    return () => clearTimeout(timer);
  }, [activeWatches]);

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
    setExpiredWatches([]);
  }, [userId]);

  // A screen re-declaring its scope on focus must not be able to restart a look
  // that just hit the ceiling — that would turn the map into a loop that
  // reopens itself every minute and notifies the trackee each time, which is
  // the opposite of the point. Only an explicit tap clears the mark.
  const expiredRef = useRef<ExpiredWatch[]>([]);
  useEffect(() => {
    expiredRef.current = expiredWatches;
  }, [expiredWatches]);

  const setWatchTargets = useCallback((next: WatchTarget[]) => {
    if (next.length === 0) {
      // Leaving the map entirely clears the marks. Coming back is deliberate,
      // and a deliberate return is allowed to start a new look.
      setExpiredWatches((current) => (current.length === 0 ? current : []));
      setTargets((current) => (current.length === 0 ? current : []));
      return;
    }
    const allowed = next.filter(
      (target) =>
        !expiredRef.current.some(
          (watch) => watch.trackeeId === target.trackeeId,
        ),
    );
    setTargets((current) => (sameTargets(current, allowed) ? current : allowed));
  }, []);

  const clearExpired = useCallback((trackeeId: string) => {
    setExpiredWatches((current) =>
      current.some((watch) => watch.trackeeId === trackeeId) ?
        current.filter((watch) => watch.trackeeId !== trackeeId) :
        current,
    );
  }, []);

  const addWatchTarget = useCallback(
    (target: WatchTarget) => {
      clearExpired(target.trackeeId);
      setTargets((current) =>
        current.some((existing) => existing.trackeeId === target.trackeeId) ?
          current :
          [...current, target],
      );
    },
    [clearExpired],
  );

  const resumeWatch = addWatchTarget;

  const removeWatchTarget = useCallback(
    (trackeeId: string) => {
      clearExpired(trackeeId);
      setTargets((current) =>
        current.filter((target) => target.trackeeId !== trackeeId),
      );
    },
    [clearExpired],
  );

  // The trackee's banner must go out exactly when the ceiling passes, not when
  // the reaper next runs — it lags by up to a minute, and a banner that says
  // "someone is watching you" after the database has stopped serving your
  // position is a lie in the direction that matters most.
  const [ceilingTick, setCeilingTick] = useState(0);

  useEffect(() => {
    const expiries = watchers
      .map((session) =>
        typeof session.startedAt === "number" ?
          session.startedAt + WATCH_SESSION_MAX_MS :
          0,
      )
      .filter((expiry) => expiry > Date.now());
    if (expiries.length === 0) return;

    const timer = setTimeout(
      () => setCeilingTick((tick) => tick + 1),
      Math.max(250, Math.min(...expiries) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [watchers, ceilingTick]);

  const liveWatchers = useMemo(() => {
    const now = Date.now();
    return watchers.filter(
      (session) =>
        typeof session.startedAt === "number" &&
        now - session.startedAt < WATCH_SESSION_MAX_MS,
    );
    // ceilingTick is the dependency that re-runs this the instant a watcher
    // ages out, without polling on a timer the rest of the time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchers, ceilingTick]);

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
      watchers: liveWatchers,
      activeWatches,
      expiredWatches,
      setWatchTargets,
      addWatchTarget,
      removeWatchTarget,
      resumeWatch,
      isLoading,
    };
  }, [
    activeWatches,
    addWatchTarget,
    expiredWatches,
    isLoading,
    links,
    liveWatchers,
    myName,
    removeWatchTarget,
    resumeWatch,
    setWatchTargets,
    userId,
  ]);

  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  );
};
