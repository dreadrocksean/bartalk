// Keeps the camera framed on everyone who matters — as tight as possible while
// every pin stays visible — without ever fighting the user's hands.
//
// Manual gestures always win immediately. The frame is only reclaimed once the
// user has been still for AUTO_FIT_RESUME_DELAY_MS, and the countdown is
// surfaced in the UI so the camera never moves unannounced.

import { useCallback, useEffect, useRef, useState } from "react";
import type MapView from "react-native-maps";

import type { LatLng } from "../app/types/tracking";
import {
  AUTO_FIT_ANIMATION_GUARD_MS,
  AUTO_FIT_EDGE_PADDING,
  AUTO_FIT_RESUME_DELAY_MS,
  MIN_FIT_SPAN_DELTA,
} from "../tracking/constants";

const FIT_ANIMATION_MS = 600;
const COUNTDOWN_TICK_MS = 250;

export const useAutoFitMap = (coordinates: LatLng[]) => {
  const mapRef = useRef<MapView | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const isReadyRef = useRef(false);
  const isManualRef = useRef(false);
  /**
   * Android reports region changes repeatedly during our own animation, and
   * Apple Maps never sets details.isGesture at all, so a time window around each
   * programmatic move is what actually distinguishes us from the user.
   */
  const programmaticUntilRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const coordinatesKey = coordinates
    .map(
      (coordinate) =>
        `${coordinate.latitude.toFixed(5)},${coordinate.longitude.toFixed(5)}`,
    )
    .join("|");

  const clearTimers = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const fit = useCallback(() => {
    const map = mapRef.current;
    if (!map || !isReadyRef.current || coordinates.length === 0) return;

    programmaticUntilRef.current = Date.now() + AUTO_FIT_ANIMATION_GUARD_MS;

    const latitudes = coordinates.map((coordinate) => coordinate.latitude);
    const longitudes = coordinates.map((coordinate) => coordinate.longitude);
    const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
    const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);

    // People standing together would otherwise slam the camera to maximum zoom,
    // which reads as a glitch rather than as information.
    const isTooTight =
      coordinates.length === 1 ||
      (latitudeSpan < MIN_FIT_SPAN_DELTA && longitudeSpan < MIN_FIT_SPAN_DELTA);

    if (isTooTight) {
      map.animateToRegion(
        {
          latitude: (Math.max(...latitudes) + Math.min(...latitudes)) / 2,
          longitude: (Math.max(...longitudes) + Math.min(...longitudes)) / 2,
          latitudeDelta: MIN_FIT_SPAN_DELTA,
          longitudeDelta: MIN_FIT_SPAN_DELTA,
        },
        FIT_ANIMATION_MS,
      );
      return;
    }

    map.fitToCoordinates(coordinates, {
      edgePadding: { ...AUTO_FIT_EDGE_PADDING },
      animated: true,
    });
  }, [coordinates]);

  const resumeAutoFit = useCallback(() => {
    clearTimers();
    isManualRef.current = false;
    setIsManual(false);
    setSecondsRemaining(0);
    fit();
  }, [clearTimers, fit]);

  const suspendAutoFit = useCallback(() => {
    // Our own camera animation is not the user taking over.
    if (Date.now() < programmaticUntilRef.current) return;

    isManualRef.current = true;
    setIsManual(true);
    clearTimers();

    const deadline = Date.now() + AUTO_FIT_RESUME_DELAY_MS;
    setSecondsRemaining(Math.ceil(AUTO_FIT_RESUME_DELAY_MS / 1000));

    countdownRef.current = setInterval(() => {
      setSecondsRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, COUNTDOWN_TICK_MS);

    resumeTimerRef.current = setTimeout(resumeAutoFit, AUTO_FIT_RESUME_DELAY_MS);
  }, [clearTimers, resumeAutoFit]);

  // fitToCoordinates throws on Android if called before layout, so the first fit
  // waits for the map to say it is ready.
  const handleMapReady = useCallback(() => {
    isReadyRef.current = true;
    fit();
  }, [fit]);

  const handleRegionChangeComplete = useCallback(
    (_region: unknown, details?: { isGesture?: boolean }) => {
      // Google Maps tells us outright; elsewhere the touch handlers cover it.
      if (details?.isGesture) suspendAutoFit();
    },
    [suspendAutoFit],
  );

  // Follow the pins as they move, unless the user has taken the wheel.
  useEffect(() => {
    if (isManualRef.current) return;
    fit();
    // Refitting is keyed on the rounded positions so identical fixes don't
    // retrigger the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinatesKey]);

  useEffect(() => clearTimers, [clearTimers]);

  return {
    mapRef,
    isManual,
    secondsRemaining,
    resumeAutoFit,
    /** Spread onto <MapView>. */
    autoFitMapProps: {
      onMapReady: handleMapReady,
      onRegionChangeComplete: handleRegionChangeComplete,
      onPanDrag: suspendAutoFit,
      onTouchStart: suspendAutoFit,
    },
  };
};
