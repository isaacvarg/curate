import { type ComponentProps, useState } from "react";
import { TextInput, View } from "react-native";
import { radii, spacing, type, useTheme } from "@/theme";
import { Text } from "./text";

type FieldProps = ComponentProps<typeof TextInput> & {
  // A small-caps label above the field. Without one, the placeholder names it for screen readers.
  label?: string;
};

// A text field: a sunk well (DESIGN.md Elevation & Depth) with an ink focus ring. A multiline field
// is two touch targets tall, with its text starting at the top.
export function TextField({ label, style, accessibilityLabel, onFocus, onBlur, ...props }: FieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const input = (
    <TextInput
      placeholderTextColor={colors["ink-faint"]}
      selectionColor={colors.primary}
      accessibilityLabel={accessibilityLabel ?? label ?? props.placeholder}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        type.body,
        {
          color: colors.ink,
          backgroundColor: colors.sunk,
          borderRadius: radii.field,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: focused ? colors.primary : colors.sunk,
          minHeight: props.multiline ? spacing["touch-target"] * 2 : spacing["touch-target"],
          ...(props.multiline ? { textAlignVertical: "top" } : {}),
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        style,
      ]}
    />
  );

  if (!label) return input;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label-caps" tone="ink-muted">
        {label}
      </Text>
      {input}
    </View>
  );
}

export function EmailField(props: FieldProps) {
  return (
    <TextField
      placeholder="Email"
      autoCapitalize="none"
      autoComplete="email"
      keyboardType="email-address"
      textContentType="emailAddress"
      {...props}
    />
  );
}

// A number field with an optional unit after the value ("ml", "%"). The value stays text, so the
// caller parses and validates it.
export function NumberInput({
  label,
  unit,
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  onSubmitEditing,
}: {
  label?: string;
  unit?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  onSubmitEditing?: () => void;
}) {
  const field = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <TextField
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={[accessibilityLabel ?? label ?? placeholder, unit].filter(Boolean).join(", ")}
        onSubmitEditing={onSubmitEditing}
        style={[type.number, { flex: 1, textAlign: "right" }]}
      />
      {unit ? (
        <Text variant="ui" tone="ink-muted" importantForAccessibility="no">
          {unit}
        </Text>
      ) : null}
    </View>
  );

  if (!label) return field;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label-caps" tone="ink-muted">
        {label}
      </Text>
      {field}
    </View>
  );
}
