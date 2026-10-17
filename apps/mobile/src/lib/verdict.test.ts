import { defaultVerdict } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { formatVerdict, parseVerdictInput, stepVerdict, verdictOptions } from "./verdict";

describe("verdictOptions", () => {
  it("offers every star on the default ★1–5 scale as stars", () => {
    expect(verdictOptions(defaultVerdict.scale)).toEqual({ kind: "stars", values: [1, 2, 3, 4, 5] });
  });

  it("offers every step of other numeric scales as choices", () => {
    expect(verdictOptions({ kind: "numeric", min: 0, max: 2, step: 0.5 })).toEqual({
      kind: "choices",
      values: [0, 0.5, 1, 1.5, 2],
    });
  });

  it("offers a label scale's labels worst first", () => {
    expect(verdictOptions({ kind: "labels", labels: ["down", "meh", "up"] })).toEqual({
      kind: "choices",
      values: ["down", "meh", "up"],
    });
  });
});

describe("formatVerdict", () => {
  it("shows stars out of the maximum on a star scale", () => {
    expect(formatVerdict(defaultVerdict.scale, 4)).toBe("★★★★☆");
  });

  it("shows a value out of the maximum on other numeric scales", () => {
    expect(formatVerdict({ kind: "numeric", min: 0, max: 100, step: 1 }, 85)).toBe("85/100");
  });

  it("shows a label as itself", () => {
    expect(formatVerdict({ kind: "labels", labels: ["C", "B", "A", "S"] }, "A")).toBe("A");
  });
});

describe("verdictOptions for large numeric scales", () => {
  it("still offers chips for 0–10 in whole steps", () => {
    expect(verdictOptions({ kind: "numeric", min: 0, max: 10, step: 1 }).kind).toBe("choices");
  });

  it.each([
    ["0–100", { kind: "numeric", min: 0, max: 100, step: 1 }],
    ["0–10 in tenths", { kind: "numeric", min: 0, max: 10, step: 0.1 }],
  ] as const)("uses a stepper for %s", (_, scale) => {
    expect(verdictOptions(scale)).toEqual({ kind: "stepper" });
  });
});

describe("stepVerdict", () => {
  const hundred = { kind: "numeric", min: 0, max: 100, step: 1 } as const;
  const tenths = { kind: "numeric", min: 0, max: 10, step: 0.1 } as const;

  it("moves one step up or down", () => {
    expect(stepVerdict(hundred, 85, 1)).toBe(86);
    expect(stepVerdict(hundred, 85, -1)).toBe(84);
  });

  it("stops at the scale's ends", () => {
    expect(stepVerdict(hundred, 100, 1)).toBe(100);
    expect(stepVerdict(hundred, 0, -1)).toBe(0);
  });

  it("starts from the middle of the scale when there's no value yet", () => {
    expect(stepVerdict(hundred, null, 1)).toBe(50);
    expect(stepVerdict(hundred, null, -1)).toBe(50);
  });

  it("lands exactly on decimal steps", () => {
    expect(stepVerdict(tenths, 0.2, 1)).toBe(0.3);
  });
});

describe("parseVerdictInput", () => {
  const hundred = { kind: "numeric", min: 0, max: 100, step: 1 } as const;

  it("reads a number on the scale", () => {
    expect(parseVerdictInput(hundred, " 85 ")).toEqual({ value: 85 });
  });

  it.each([
    ["", "Enter a number."],
    ["great", "Enter a number."],
    ["101", "Must be at most 100."],
    ["-1", "Must be at least 0."],
    ["85.5", "Must be in steps of 1."],
  ])("explains why %j isn't on 0–100", (text, error) => {
    expect(parseVerdictInput(hundred, text)).toEqual({ error });
  });
});
