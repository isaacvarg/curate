import { useRef } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { disabledOpacity, motion, useReducedMotion } from "@/theme";

// A Pressable that scales to 0.98 while pressed (DESIGN.md Motion). With reduced motion the scale
// still changes, so a press is still visible, but without a transition.
export function PressableScale({
  style,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  const animateTo = (value: number) =>
    Animated.timing(scale, {
      toValue: value,
      duration: reducedMotion ? 0 : motion.press,
      easing: motion.easing,
      useNativeDriver: true,
    }).start();

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        animateTo(motion.pressedScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        onPressOut?.(event);
      }}
      style={[style, { transform: [{ scale }] }, disabled ? { opacity: disabledOpacity } : null]}
    />
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
