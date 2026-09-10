// Every screen declares who it is showing a live position for. That declaration
// is what opens and closes watch sessions, so there is no way to display a
// position without the person being told — the notification is a property of the
// screen being on, not something a caller has to remember to trigger.

import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { useTracking, type WatchTarget } from "../tracking/tracking-provider";

export type WatchScopeMode =
  /**
   * This screen shows live positions. The given people are added to the watched
   * set if they aren't in it already; anyone added on this screen since (via
   * Other Trackees) is kept, so returning from a chat doesn't silently drop
   * people off the map.
   */
  | "watch"
  /**
   * This screen may continue an existing watch of these people, but never
   * starts one. Used by the chat screen, which shows a live mini map only when
   * you arrived from the map already watching that person.
   */
  | "preserve"
  /** This screen shows nobody's position. Ends any open session. */
  | "none";

export const useWatchScope = (
  mode: WatchScopeMode,
  targets: WatchTarget[] = [],
) => {
  const { setWatchTargets, activeWatches } = useTracking();

  useFocusEffect(
    useCallback(() => {
      if (mode === "none") {
        setWatchTargets([]);
        return;
      }
      if (mode === "watch") {
        const existing = activeWatches.map((watch) => ({
          trackeeId: watch.trackeeId,
          trackeeName: watch.trackeeName,
        }));
        const additions = targets.filter(
          (target) =>
            !existing.some((watch) => watch.trackeeId === target.trackeeId),
        );
        setWatchTargets([...existing, ...additions]);
        return;
      }
      // preserve: keep only the people this screen is about, and only if they
      // were already being watched. Leaving the map narrows the set rather than
      // silently keeping other people's sessions alive off-screen.
      const ids = new Set(targets.map((target) => target.trackeeId));
      setWatchTargets(
        activeWatches
          .filter((watch) => ids.has(watch.trackeeId))
          .map((watch) => ({
            trackeeId: watch.trackeeId,
            trackeeName: watch.trackeeName,
          })),
      );
      // activeWatches is deliberately not a dependency: this runs on focus to
      // take a decision from the state at that moment, and re-running it as
      // sessions change would fight the provider.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, JSON.stringify(targets), setWatchTargets]),
  );
};
