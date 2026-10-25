/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { designMdPath, lintDesign, renderTokens, tokensPath } from "./generate";

const designMd = readFileSync(designMdPath, "utf8");

describe("DESIGN.md and the generated tokens", () => {
  it("DESIGN.md lints with no errors or warnings, contrast included", () => {
    const problems = lintDesign(designMd).filter((f) => f.severity !== "info");
    expect(problems.map((f) => `${f.severity} ${f.path ?? ""}: ${f.message}`)).toEqual([]);
  });

  it("tokens.ts is up to date with DESIGN.md (run `pnpm tokens`)", () => {
    expect(readFileSync(tokensPath, "utf8")).toBe(renderTokens(designMd));
  });
});
