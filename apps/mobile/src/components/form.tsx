import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";

export function Field(props: ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor="#888" {...props} style={[styles.input, props.style]} />;
}

export function EmailField(props: ComponentProps<typeof TextInput>) {
  return (
    <Field
      placeholder="Email"
      autoCapitalize="none"
      autoComplete="email"
      keyboardType="email-address"
      {...props}
    />
  );
}

export function Button({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.buttonDimmed]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

export const formStyles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12 },
});

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2f6fed",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  buttonDimmed: { opacity: 0.6 },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  error: { color: "#c62828", fontSize: 15 },
});
