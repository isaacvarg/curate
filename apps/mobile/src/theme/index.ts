import { type ColorName, color, radii, spacing, typography, type TypographyName } from "@repo/shared/design";
import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Easing, type TextStyle, useColorScheme } from "react-native";

// How the app applies DESIGN.md's generated tokens. MOBILE-DESIGN.md explains the rules; every value
// here comes from @repo/shared/design except the font file names, which scripts/cut-fonts.py makes.

export { radii, spacing };
export type { ColorName };

export type Colors = (typeof color)[keyof typeof color];

// The eight Collection accents, each with its -tint, -text and -wash tones.
export type AccentName = "moss" | "amber" | "slate" | "coral" | "plum" | "teal" | "olive" | "rose";

// The palette for the system's light/dark setting. Brand colours are fixed light/dark pairs, so they
// are read at render time rather than baked into static styles.
export function useTheme(): { dark: boolean; colors: Colors } {
  const dark = useColorScheme() === "dark";
  return { dark, colors: dark ? color.dark : color.light };
}

// The fill and the colour of text on it for a selected control: the Collection's accent when there
// is one, otherwise ink (DESIGN.md: accents mark data, chrome is ink).
export function selectedColors(colors: Colors, accent?: AccentName): { fill: string; onFill: string } {
  return accent ? { fill: colors[accent], onFill: colors.ground } : { fill: colors.primary, onFill: colors["on-primary"] };
}

// The bundled font files (scripts/cut-fonts.py), loaded in the root layout.
export const fontFiles = {
  "Fraunces-Regular": require("../../assets/fonts/Fraunces-Regular.ttf"),
  "Fraunces-Book": require("../../assets/fonts/Fraunces-Book.ttf"),
  "Fraunces-Medium": require("../../assets/fonts/Fraunces-Medium.ttf"),
  "Fraunces-Italic": require("../../assets/fonts/Fraunces-Italic.ttf"),
  "Figtree-Regular": require("../../assets/fonts/Figtree-Regular.ttf"),
  "Figtree-SemiBold": require("../../assets/fonts/Figtree-SemiBold.ttf"),
} as const;

type FontFile = keyof typeof fontFiles;

// Static files carry the weight, so styles name the file instead of setting fontWeight (which would
// make iOS synthesise a weight or fall back to the system font).
function fontFile(style: TypographyName): FontFile {
  const { fontFamily, fontWeight } = typography[style];
  if (fontFamily === "Figtree") return fontWeight >= 600 ? "Figtree-SemiBold" : "Figtree-Regular";
  if (isItalic(style)) return "Fraunces-Italic";
  if (fontWeight >= 500) return "Fraunces-Medium";
  if (fontWeight > 400) return "Fraunces-Book";
  return "Fraunces-Regular";
}

// DESIGN.md has no fontStyle or textTransform, so the style names carry them.
function isItalic(style: TypographyName): boolean {
  return style.endsWith("-italic");
}

function textStyle(style: TypographyName): TextStyle {
  const token = typography[style];
  return {
    fontFamily: fontFile(style),
    fontSize: token.fontSize,
    lineHeight: Math.round(token.fontSize * token.lineHeight),
    ...("letterSpacingEm" in token ? { letterSpacing: token.letterSpacingEm * token.fontSize } : {}),
    ...("fontFeature" in token ? { fontVariant: ["lining-nums", "tabular-nums"] } : {}),
    ...(style === "label-caps" ? { textTransform: "uppercase" } : {}),
  };
}

// One text style per DESIGN.md type style, without colour. Use them through <Text variant>.
export const type = Object.fromEntries(
  (Object.keys(typography) as TypographyName[]).map((style) => [style, textStyle(style)]),
) as Record<TypographyName, TextStyle>;

// DESIGN.md Motion.
export const motion = {
  press: 120,
  fill: 240,
  pressedScale: 0.98,
  easing: Easing.bezier(0.22, 0.61, 0.36, 1),
} as const;

// DESIGN.md Iconography: Lucide at a 1.5 stroke, 22pt, or 16pt inline.
export const icon = { size: 22, inline: 16, stroke: 1.5 } as const;

// Disabled controls fade; DESIGN.md doesn't style them, so this is the app's rule (MOBILE-DESIGN.md).
export const disabledOpacity = 0.4;

// Whether the user asked the system to reduce motion. When it's on, every transition is off.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => mounted && setReduced(value));
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

// Navigation chrome (headers, the back button, the screen background) in the brand palette.
export function navigationTheme(dark: boolean): Theme {
  const base = dark ? DarkTheme : DefaultTheme;
  const colors = dark ? color.dark : color.light;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.ground,
      card: colors.ground,
      text: colors.ink,
      border: colors.line,
      notification: colors.primary,
    },
  };
}

// Stack header text in the brand type: titles are upright Fraunces (DESIGN.md Typography).
export const headerTitleStyle = { fontFamily: fontFile("heading"), fontSize: typography.heading.fontSize };
export const headerBackTitleStyle = { fontFamily: fontFile("ui"), fontSize: typography.ui.fontSize };
