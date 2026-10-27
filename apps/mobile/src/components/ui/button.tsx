import type { LucideIcon } from "lucide-react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { icon, radii, spacing, useTheme } from "@/theme";
import { PressableScale } from "./pressable";
import { Text } from "./text";

const buttonHeight = 52; // DESIGN.md button-primary and button-secondary height

// DESIGN.md's buttons: an ink pill for the primary action, an outlined pill for a secondary one, and
// a text button (an ink label, at least 44pt tall) for quiet actions.
export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  accessibilityLabel,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "text";
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const look = {
    primary: { backgroundColor: colors.primary, borderColor: colors.primary, color: colors["on-primary"] },
    secondary: { backgroundColor: colors.ground, borderColor: colors["line-strong"], color: colors.ink },
    text: { backgroundColor: undefined, borderColor: undefined, color: colors.ink },
  }[variant];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={variant === "text" ? spacing.xs : undefined}
      style={[
        variant === "text"
          ? { minHeight: spacing["touch-target-min"], justifyContent: "center", alignSelf: "flex-start" }
          : {
              minHeight: buttonHeight,
              paddingHorizontal: spacing.xl,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: look.borderColor,
              backgroundColor: look.backgroundColor,
              alignItems: "center",
              justifyContent: "center",
            },
        style,
      ]}
    >
      <Text variant="ui-strong" style={{ color: look.color, textAlign: "center" }}>
        {title}
      </Text>
    </PressableScale>
  );
}

// A round 44pt button holding one icon, such as a stepper's − and +. `label` names it for screen
// readers.
export function IconButton({
  icon: Icon,
  label,
  onPress,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={{
        width: spacing["touch-target-min"],
        height: spacing["touch-target-min"],
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors["line-strong"],
        backgroundColor: colors.ground,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={icon.size} strokeWidth={icon.stroke} color={colors.ink} />
    </PressableScale>
  );
}
