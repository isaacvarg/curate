// Generates tokens.ts from the repo's DESIGN.md: colour (light and dark), type scale, spacing and
// radii as plain values, with no React Native or web dependency. Run `pnpm tokens` after editing
// DESIGN.md; tokens.test.ts fails when tokens.ts is stale or DESIGN.md doesn't lint cleanly.

/// <reference types="node" />
import { readFileSync, writeFileSync } from "node:fs";
import { DtcgEmitterHandler, type Finding, lint } from "@google/design.md/linter";

export const designMdPath = new URL("../../../../DESIGN.md", import.meta.url);
export const tokensPath = new URL("./tokens.ts", import.meta.url);

type Dimension = { value: number; unit: string };
type DtcgToken = { $value: unknown };
type DtcgTypography = {
  fontFamily: string;
  fontSize: Dimension;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: Dimension;
};

export function lintDesign(designMd: string): Finding[] {
  return lint(designMd).findings;
}

export function renderTokens(designMd: string): string {
  const { designSystem } = lint(designMd);
  const exported = new DtcgEmitterHandler().execute(designSystem);
  if (!exported.success) throw new Error(`DTCG export failed: ${exported.error.message}`);
  const dtcg = exported.data as Record<string, Record<string, DtcgToken>>;

  // DESIGN.md has no modes, so a dark value is the light name plus "-dark".
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  for (const [name, token] of entries(dtcg.color)) {
    const { hex } = token.$value as { hex: string };
    if (name.endsWith("-dark")) dark[name.slice(0, -"-dark".length)] = hex.toUpperCase();
    else light[name] = hex.toUpperCase();
  }
  const unpaired = [...Object.keys(light), ...Object.keys(dark)].filter((n) => !(n in light && n in dark));
  if (unpaired.length > 0) throw new Error(`Colours without both a light and a -dark value: ${[...new Set(unpaired)].join(", ")}`);

  // The DTCG export drops fontFeature and fontVariation, so those come from the resolved model.
  const typography: Record<string, Record<string, string | number>> = {};
  for (const [name, token] of entries(dtcg.typography)) {
    const t = token.$value as DtcgTypography;
    if (t.lineHeight === undefined) throw new Error(`typography.${name} has no lineHeight (quote unitless values in DESIGN.md)`);
    const source = designSystem.typography.get(name);
    typography[name] = {
      fontFamily: t.fontFamily,
      fontSize: px(t.fontSize, `typography.${name}.fontSize`),
      fontWeight: t.fontWeight ?? 400,
      lineHeight: t.lineHeight,
      ...(t.letterSpacing && { letterSpacingEm: em(t.letterSpacing, `typography.${name}.letterSpacing`) }),
      ...(source?.fontFeature && { fontFeature: source.fontFeature }),
      ...(source?.fontVariation && { fontVariation: source.fontVariation }),
    };
  }

  const scale = (group: string) =>
    Object.fromEntries(entries(dtcg[group]).map(([name, token]) => [name, px(token.$value as Dimension, `${group}.${name}`)]));

  return `// Generated from DESIGN.md by \`pnpm tokens\`. Do not edit: change DESIGN.md and regenerate.
// tokens.test.ts fails when this file is out of date with DESIGN.md.
//
// Sizes are in points (px on the web, dp on Android). lineHeight is a multiple of fontSize, and
// letterSpacingEm is in ems.

export const color = ${literal({ light, dark })} as const;

export const typography = ${literal(typography)} as const;

export const spacing = ${literal(scale("spacing"))} as const;

export const radii = ${literal(scale("rounded"))} as const;

export type ColorName = keyof typeof color.light;
export type TypographyName = keyof typeof typography;
`;
}

function entries(group: Record<string, DtcgToken> | undefined): [string, DtcgToken][] {
  return Object.entries(group ?? {}).filter(([name]) => !name.startsWith("$"));
}

function px(d: Dimension, path: string): number {
  if (d.unit !== "px") throw new Error(`${path} must be in px, got ${d.value}${d.unit}`);
  return d.value;
}

function em(d: Dimension, path: string): number {
  if (d.unit !== "em") throw new Error(`${path} must be in em, got ${d.value}${d.unit}`);
  return d.value;
}

function literal(value: unknown, indent = ""): string {
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  const inner = `${indent}  `;
  const lines = Object.entries(value).map(([k, v]) => `${inner}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${literal(v, inner)},`);
  return `{\n${lines.join("\n")}\n${indent}}`;
}

if (import.meta.main) {
  writeFileSync(tokensPath, renderTokens(readFileSync(designMdPath, "utf8")));
  console.log("wrote packages/shared/src/design/tokens.ts");
}
