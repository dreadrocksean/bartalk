import { useEffect, useMemo } from "react";
import {
  Animated,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";

type TypingIndicatorDotsProps = {
  dotColor?: string;
  dotSize?: number;
  style?: StyleProp<ViewStyle>;
};

const DOT_COUNT = 3;
const DOT_STAGGER_MS = 140;
const DOT_ANIMATION_MS = 280;
const DOT_REST_MS = 220;

export const TypingIndicatorDots = ({
  dotColor = "#8E8E93",
  dotSize = 7,
  style,
}: TypingIndicatorDotsProps) => {
  const dotAnimations = useMemo(
    () => Array.from({ length: DOT_COUNT }, () => new Animated.Value(0)),
    [],
  );

  useEffect(() => {
    const loops = dotAnimations.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * DOT_STAGGER_MS),
          Animated.timing(value, {
            toValue: 1,
            duration: DOT_ANIMATION_MS,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: DOT_ANIMATION_MS,
            useNativeDriver: true,
          }),
          Animated.delay(DOT_REST_MS),
        ]),
      ),
    );

    loops.forEach((loop) => loop.start());

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [dotAnimations]);

  return (
    <View style={[styles.container, style]} accessibilityLabel="Typing indicator">
      {dotAnimations.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: dotColor,
              opacity: value.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 1],
              }),
              transform: [
                {
                  translateY: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -3],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    marginHorizontal: 2,
  },
});
