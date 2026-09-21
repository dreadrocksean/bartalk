import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import styles from "../styles";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
/** What a double tap jumps to, and back from. */
const DOUBLE_TAP_SCALE = 2.5;
const SETTLE_MS = 180;
/** Floating point noise means "zoomed" can't be a test against exactly 1. */
const ZOOMED_THRESHOLD = 1.01;

type ZoomableMediaProps = {
  /** The page box the content is laid out in. */
  width: number;
  height: number;
  /** The content's own size once fitted, used to stop panning into empty space. */
  contentWidth: number;
  contentHeight: number;
  /** Pages that scroll off reset, so returning to one starts unzoomed. */
  isActive: boolean;
  onZoomChange: (isZoomed: boolean) => void;
  /** Omitted for video, where taps belong to the playback controls. */
  onTap?: () => void;
  children: ReactNode;
};

const clamp = (value: number, min: number, max: number) => {
  "worklet";
  return Math.min(Math.max(value, min), max);
};

/**
 * Pinch, pan and double-tap zoom for one page of the viewer.
 *
 * Panning is only enabled once zoomed in. Below that the gesture has to reach
 * the horizontal pager underneath, or swiping between attachments would stop
 * working.
 */
export const ZoomableMedia = ({
  width,
  height,
  contentWidth,
  contentHeight,
  isActive,
  onZoomChange,
  onTap,
  children,
}: ZoomableMediaProps) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleZoomChange = useCallback(
    (zoomed: boolean) => {
      setIsZoomed(zoomed);
      onZoomChange(zoomed);
    },
    [onZoomChange],
  );

  /** How far the content may travel before its edge leaves the box. */
  const maxOffset = (currentScale: number) => {
    "worklet";
    return {
      x: Math.max(0, (contentWidth * currentScale - width) / 2),
      y: Math.max(0, (contentHeight * currentScale - height) / 2),
    };
  };

  const applyResting = (nextScale: number, nextX: number, nextY: number) => {
    "worklet";
    // Targets are computed before anything is animated: reading a shared value
    // back straight after assigning withTiming gives the old value, not the
    // destination.
    savedScale.value = nextScale;
    savedTranslateX.value = nextX;
    savedTranslateY.value = nextY;
    scale.value = withTiming(nextScale, { duration: SETTLE_MS });
    translateX.value = withTiming(nextX, { duration: SETTLE_MS });
    translateY.value = withTiming(nextY, { duration: SETTLE_MS });
  };

  const settle = () => {
    "worklet";
    const nextScale = clamp(scale.value, MIN_SCALE, MAX_SCALE);
    if (nextScale <= MIN_SCALE) {
      applyResting(1, 0, 0);
      return;
    }
    const limit = maxOffset(nextScale);
    applyResting(
      nextScale,
      clamp(translateX.value, -limit.x, limit.x),
      clamp(translateY.value, -limit.y, limit.y),
    );
  };

  // The pager has to stop scrolling while a page is zoomed, or a pan would
  // page across instead of moving the picture.
  useAnimatedReaction(
    () => scale.value > ZOOMED_THRESHOLD,
    (zoomedNow, zoomedBefore) => {
      if (zoomedNow === zoomedBefore) return;
      runOnJS(handleZoomChange)(zoomedNow);
    },
  );

  useEffect(() => {
    if (isActive) return;
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [
    isActive,
    savedScale,
    savedTranslateX,
    savedTranslateY,
    scale,
    translateX,
    translateY,
  ]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = clamp(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE);
      const ratio = next / savedScale.value;
      // Keep whatever is under the fingers under the fingers.
      const focalX = event.focalX - width / 2;
      const focalY = event.focalY - height / 2;
      scale.value = next;
      translateX.value = focalX - (focalX - savedTranslateX.value) * ratio;
      translateY.value = focalY - (focalY - savedTranslateY.value) * ratio;
    })
    .onEnd(settle);

  // One finger only: two-finger movement belongs to the pinch, and letting
  // both drive the offset at once makes it fight itself.
  const pan = Gesture.Pan()
    .enabled(isZoomed)
    .minPointers(1)
    .maxPointers(1)
    .onUpdate((event) => {
      const limit = maxOffset(scale.value);
      translateX.value = clamp(
        savedTranslateX.value + event.translationX,
        -limit.x,
        limit.x,
      );
      translateY.value = clamp(
        savedTranslateY.value + event.translationY,
        -limit.y,
        limit.y,
      );
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .onEnd((event) => {
      if (scale.value > ZOOMED_THRESHOLD) {
        applyResting(1, 0, 0);
        return;
      }
      const focalX = event.x - width / 2;
      const focalY = event.y - height / 2;
      const limit = maxOffset(DOUBLE_TAP_SCALE);
      applyResting(
        DOUBLE_TAP_SCALE,
        clamp(focalX - focalX * DOUBLE_TAP_SCALE, -limit.x, limit.x),
        clamp(focalY - focalY * DOUBLE_TAP_SCALE, -limit.y, limit.y),
      );
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      // A tap that dismisses would be surprising while zoomed in.
      if (scale.value > ZOOMED_THRESHOLD) return;
      if (onTap) runOnJS(onTap)();
    });

  // Video registers no tap gestures at all: they would swallow the taps that
  // show and hide the native playback controls.
  const gesture = onTap
    ? Gesture.Race(
        Gesture.Simultaneous(pinch, pan),
        Gesture.Exclusive(doubleTap, singleTap),
      )
    : Gesture.Race(Gesture.Simultaneous(pinch, pan), doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.mediaViewerPage, { width, height }]}>
        <Animated.View style={animatedStyle}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};
