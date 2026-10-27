import type { TypographyName } from "@repo/shared/design";
import { Text as NativeText, type TextProps } from "react-native";
import { type ColorName, type, useTheme } from "@/theme";

// Text in one of DESIGN.md's type styles and palette colours. Screens never set fontSize or colour
// themselves.
export function Text({
  variant = "body",
  tone = "ink",
  style,
  ...props
}: TextProps & { variant?: TypographyName; tone?: ColorName }) {
  const { colors } = useTheme();
  return <NativeText {...props} style={[type[variant], { color: colors[tone] }, style]} />;
}
