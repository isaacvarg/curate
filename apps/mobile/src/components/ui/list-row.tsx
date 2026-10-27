import { ChevronRight } from "lucide-react-native";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { FlatList, Pressable, View } from "react-native";
import { icon, radii, spacing, useTheme } from "@/theme";
import { Text } from "./text";

const rowHeight = 60; // DESIGN.md: list rows inside a card are at least 60pt tall

// One row of a list drawn as a single card: rows join with hairlines, and the first and last round
// the card's corners, so a FlatList can render the card row by row. Wrap in <Link asChild> to
// navigate.
export function ListRow({
  title,
  detail,
  first,
  last,
  ...props
}: Omit<ComponentProps<typeof Pressable>, "children" | "style"> & {
  title: string;
  // A value on the right, such as the Verdict.
  detail?: string;
  first: boolean;
  last: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      {...props}
      style={({ pressed }) => ({
        minHeight: rowHeight,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing["card-padding"],
        backgroundColor: pressed ? colors.sunk : colors.surface,
        borderColor: colors.line,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: first ? 1 : 0,
        borderBottomWidth: 1,
        borderTopLeftRadius: first ? radii.card : 0,
        borderTopRightRadius: first ? radii.card : 0,
        borderBottomLeftRadius: last ? radii.card : 0,
        borderBottomRightRadius: last ? radii.card : 0,
        borderCurve: "continuous",
      })}
    >
      <Text variant="body" style={{ flex: 1 }}>
        {title}
      </Text>
      {detail ? (
        <Text variant="number" tone="ink-muted">
          {detail}
        </Text>
      ) : null}
      <View importantForAccessibility="no-hide-descendants">
        <ChevronRight size={icon.inline} strokeWidth={icon.stroke} color={colors["ink-faint"]} />
      </View>
    </Pressable>
  );
}

// A screen whose body is one long list drawn as a card of ListRows, with the rest of the screen
// above it (`header`) and below it (`footer`). It is the screen's scroll view, so the list stays
// virtualised. Until `data` arrives it shows `placeholder` (loading, an error); then `empty` if
// there's nothing.
export function CardList<T>({
  data,
  keyExtractor,
  renderRow,
  header,
  footer,
  placeholder,
  empty,
}: {
  data: readonly T[] | undefined;
  keyExtractor: (item: T) => string;
  renderRow: (item: T, position: { first: boolean; last: boolean }) => ReactElement;
  header?: ReactNode;
  footer?: ReactNode;
  placeholder: ReactNode;
  empty: ReactNode;
}) {
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ padding: spacing.margin }}
      data={data ?? []}
      keyExtractor={keyExtractor}
      renderItem={({ item, index }) =>
        renderRow(item, { first: index === 0, last: index === (data?.length ?? 0) - 1 })
      }
      ListHeaderComponent={header ? <View style={{ gap: spacing.section, paddingBottom: spacing.md }}>{header}</View> : undefined}
      ListEmptyComponent={<>{data ? empty : placeholder}</>}
      ListFooterComponent={footer ? <View style={{ paddingTop: spacing.section }}>{footer}</View> : undefined}
    />
  );
}
