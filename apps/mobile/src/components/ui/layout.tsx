import type { ReactNode } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { CircleAlert } from "lucide-react-native";
import { icon, radii, spacing, useTheme } from "@/theme";
import { Text } from "./text";

// A screen's scrolling body: the side margin, the gap between sections, and the safe areas.
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ padding: spacing.margin, gap: spacing.section }}
    >
      {children}
    </ScrollView>
  );
}

// A screen section: an italic serif head (DESIGN.md's first heading level) over its content.
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      {title ? (
        <Text variant="section-italic" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

// A small-caps label naming a group inside a section (DESIGN.md's second heading level).
export function Label({ children }: { children: string }) {
  return (
    <Text variant="label-caps" tone="ink-muted">
      {children}
    </Text>
  );
}

// A tonal card with a hairline: things that act as a unit (DESIGN.md Elevation & Depth).
export function Card({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: radii.card,
        borderCurve: "continuous",
        overflow: "hidden",
        padding: padded ? spacing["card-padding"] : 0,
        gap: spacing.md,
      }}
    >
      {children}
    </View>
  );
}

// A first load in progress.
export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: spacing["2xl"], alignItems: "center" }}>
      <ActivityIndicator color={colors["ink-muted"]} accessibilityLabel="Loading" />
    </View>
  );
}

// An error, announced to screen readers. DESIGN.md has no error colour, so it's ink with an icon.
export function ErrorText({ children }: { children: string | null }) {
  const { colors } = useTheme();
  if (!children) return null;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
      <CircleAlert size={icon.inline} strokeWidth={icon.stroke} color={colors.ink} style={{ marginTop: spacing.xs / 2 }} />
      <Text variant="ui" selectable style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

// What a list says when it has nothing in it.
export function EmptyText({ children }: { children: string }) {
  return (
    <Text variant="ui" tone="ink-muted">
      {children}
    </Text>
  );
}

// Secondary guidance under a heading or field.
export function Hint({ children }: { children: ReactNode }) {
  return (
    <Text variant="meta" tone="ink-muted">
      {children}
    </Text>
  );
}
