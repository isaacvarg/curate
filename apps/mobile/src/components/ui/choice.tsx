import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Calendar, Check, Plus } from "lucide-react-native";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Switch, View } from "react-native";
import {
  type AccentName,
  disabledOpacity,
  icon,
  motion,
  radii,
  selectedColors,
  spacing,
  type,
  useReducedMotion,
  useTheme,
} from "@/theme";
import { Text } from "./text";

export type Option<T> = { value: T; label: string };

const segmentHeight = 44; // DESIGN.md match-toggle height

// One choice from a few, as chips. Selected chips fill with `accent` when the choice is about a
// Collection's data, or ink when it's a setting.
export function SingleChoice<T>({
  options,
  value,
  onChange,
  accent,
  label,
  disabled,
}: {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  accent?: AccentName;
  // Names the group for screen readers.
  label: string;
  disabled?: boolean;
}) {
  return (
    <ChipGrid label={label} single>
      {options.map((option) => (
        <Chip
          key={option.label}
          role="radio"
          title={option.label}
          selected={option.value === value}
          accent={accent}
          disabled={disabled}
          onPress={() => onChange(option.value)}
        />
      ))}
    </ChipGrid>
  );
}

// Any number of choices, as chips with + and ✓ so the state never relies on colour alone
// (DESIGN.md Choice chips).
export function MultipleChoice<T>({
  options,
  values,
  onChange,
  accent,
  label,
  disabled,
}: {
  options: Option<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  accent?: AccentName;
  label: string;
  disabled?: boolean;
}) {
  return (
    <ChipGrid label={label} single={false}>
      {options.map((option) => {
        const selected = values.includes(option.value);
        return (
          <Chip
            key={option.label}
            role="checkbox"
            title={option.label}
            selected={selected}
            accent={accent}
            disabled={disabled}
            onPress={() =>
              onChange(selected ? values.filter((v) => v !== option.value) : [...values, option.value])
            }
          />
        );
      })}
    </ChipGrid>
  );
}

// Two columns so the targets are even; a label too long for half the width takes the whole row.
function ChipGrid({ label, single, children }: { label: string; single: boolean; children: ReactNode }) {
  return (
    <View
      accessibilityRole={single ? "radiogroup" : undefined}
      accessibilityLabel={label}
      style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
    >
      {children}
    </View>
  );
}

function Chip({
  role,
  title,
  selected,
  accent,
  disabled,
  onPress,
}: {
  role: "radio" | "checkbox";
  title: string;
  selected: boolean;
  accent?: AccentName;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { fill, onFill } = selectedColors(colors, accent);
  const progress = useFill(selected);
  const Icon = selected ? Check : Plus;

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{ flexGrow: 1, flexBasis: "40%", opacity: disabled ? disabledOpacity : 1 }}
    >
      <View
        style={{
          minHeight: spacing["touch-target"],
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: selected ? fill : colors["line-strong"],
          backgroundColor: colors.ground,
          overflow: "hidden",
          paddingHorizontal: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        {/* The fill fades in on the native thread; the label and border switch at once. */}
        <Animated.View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: fill, opacity: progress }}
        />
        <Text variant="ui" style={{ color: selected ? onFill : colors.ink, flexShrink: 1 }}>
          {title}
        </Text>
        {role === "checkbox" || selected ? (
          <Icon size={icon.inline} strokeWidth={icon.stroke} color={selected ? onFill : colors["ink-muted"]} />
        ) : null}
      </View>
    </Pressable>
  );
}

// 0 → 1 as a control becomes selected, over 240ms, or at once with reduced motion.
function useFill(selected: boolean): Animated.Value {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: reducedMotion ? 0 : motion.fill,
      easing: motion.easing,
      useNativeDriver: true,
    }).start();
  }, [selected, reducedMotion, progress]);
  return progress;
}

// A segmented pill track for two or three short options, such as all of / any of (DESIGN.md
// match-toggle): the chosen side is a ground pill on a sunk track.
export function SegmentedControl<T>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        backgroundColor: colors.sunk,
        borderRadius: radii.pill,
        padding: spacing.xs / 2,
        opacity: disabled ? disabledOpacity : 1,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: segmentHeight - spacing.xs,
              borderRadius: radii.pill,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: spacing.md,
              backgroundColor: selected ? colors.ground : undefined,
              borderWidth: 1,
              borderColor: selected ? colors.line : colors.sunk,
            }}
          >
            <Text variant="meta" style={selected ? { fontFamily: type["ui-strong"].fontFamily } : null}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A yes/no setting as a labelled row with the platform switch, which brings its own haptics and
// accessibility. The track is ink when on.
export function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        minHeight: spacing["touch-target"],
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
      }}
    >
      <Text variant="ui" style={{ flex: 1 }} importantForAccessibility="no">
        {label}
      </Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors["line-strong"], true: colors.primary }}
        ios_backgroundColor={colors["line-strong"]}
        thumbColor={colors.surface}
      />
    </View>
  );
}

// A date, chosen with the platform picker: Android's dialog, or iOS's calendar shown under the field.
export function DateInput({
  label,
  value,
  onChange,
  placeholder = "Not set",
  minimumDate,
  maximumDate,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const { colors, dark } = useTheme();
  const [open, setOpen] = useState(false);
  const shown = value ? value.toLocaleDateString(undefined, { dateStyle: "medium" }) : placeholder;

  const press = () => {
    if (process.env.EXPO_OS === "android") {
      DateTimePickerAndroid.open({
        value: value ?? new Date(),
        mode: "date",
        minimumDate,
        maximumDate,
        onChange: (event, date) => event.type === "set" && date && onChange(date),
      });
    } else {
      setOpen((current) => !current);
    }
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label-caps" tone="ink-muted" importantForAccessibility="no">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${shown}`}
        accessibilityState={{ expanded: open }}
        onPress={press}
        style={{
          minHeight: spacing["touch-target"],
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.md,
          backgroundColor: colors.sunk,
          borderRadius: radii.field,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: open ? colors.primary : colors.sunk,
        }}
      >
        <Text variant="body" tone={value ? "ink" : "ink-faint"}>
          {shown}
        </Text>
        <Calendar size={icon.inline} strokeWidth={icon.stroke} color={colors["ink-muted"]} />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display="inline"
          themeVariant={dark ? "dark" : "light"}
          accentColor={colors.primary}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_, date) => date && onChange(date)}
        />
      ) : null}
    </View>
  );
}
